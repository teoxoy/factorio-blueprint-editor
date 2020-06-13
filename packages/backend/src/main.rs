use actix_web::{get, http::header, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use bytes::{Bytes, BytesMut};
use cached::proc_macro::cached;
use serde::Deserialize;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

mod bundle;
mod setup;
mod util;

#[macro_use]
extern crate lazy_static;

static FACTORIO_VERSION: &str = "0.18.24";

lazy_static! {
    static ref DATA_DIR: PathBuf = PathBuf::from("./data");
    static ref FACTORIO_DATA: PathBuf = DATA_DIR.join("factorio/data");
}

#[derive(Clone)]
struct AppState {
    client: reqwest::Client,
    bundle: String,
}

#[derive(Deserialize)]
pub struct ProxyQueryParams {
    url: String,
}

#[get("/healthz")]
async fn _healthz() -> impl Responder {
    HttpResponse::NoContent().finish()
}

#[get("/api/bundle")]
async fn _bundle(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
    let mut response = HttpResponse::Ok();

    let cache_control = header::CacheControl(vec![
        header::CacheDirective::Public,
        header::CacheDirective::NoCache,
    ]);
    response.set(cache_control);

    let hash = seahash::hash(data.bundle.as_bytes());

    if util::etag(&req, &mut response, format!("{:X}", hash)) {
        response.finish()
    } else {
        response.content_type("application/json").body(&data.bundle)
    }
}

#[get("/api/proxy")]
async fn _proxy(query: web::Query<ProxyQueryParams>, data: web::Data<AppState>) -> impl Responder {
    let res = match data.client.get(&query.url).send().await {
        Ok(res) => res,
        Err(_) => return util::not_found(),
    };

    let status_code = res.status();
    if !status_code.is_success() {
        return util::not_found();
    }

    let mut response = HttpResponse::build(status_code);
    let content_type = res.headers().get(reqwest::header::CONTENT_TYPE);
    match content_type {
        Some(content_type) => response.content_type(content_type),
        None => response.content_type("text/plain; charset=UTF-8"),
    };
    match res.bytes().await {
        Ok(bytes) => response.body(bytes),
        Err(_) => util::not_found(),
    }
}

#[derive(Deserialize)]
pub struct GraphicsPathParams {
    src: String,
}

#[derive(Deserialize)]
pub struct GraphicsQueryParams {
    #[serde(default)]
    x: u32,
    #[serde(default)]
    y: u32,
    #[serde(default)]
    w: Option<u32>,
    #[serde(default)]
    h: Option<u32>,
}

#[cached]
async fn get_len_and_mtime(img_path: PathBuf) -> Option<(u64, u64)> {
    let file = tokio::fs::File::open(img_path).await.ok()?;
    let metadata = file.metadata().await.ok()?;
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|dur| dur.as_secs())
        .unwrap_or(0);
    Some((metadata.len(), mtime))
}

#[cached]
async fn get_image_data(img_path: PathBuf) -> Option<(Bytes, image::ImageFormat, (u32, u32))> {
    let mut file = tokio::fs::File::open(img_path.clone()).await.ok()?;
    let (len, _) = get_len_and_mtime(img_path).await?;
    let mut buffer = Vec::with_capacity(len as usize);
    use tokio::io::AsyncReadExt;
    file.read_to_end(&mut buffer).await.ok()?;
    let buffer = Bytes::from(buffer);
    let format = image::guess_format(&buffer).ok()?;
    let dimensions = image::io::Reader::with_format(std::io::Cursor::new(buffer.clone()), format)
        .into_dimensions()
        .ok()?;
    Some((buffer, format, dimensions))
}

#[get("/api/graphics/{src:.*}")]
async fn _graphics(
    req: HttpRequest,
    path: web::Path<GraphicsPathParams>,
    query: web::Query<GraphicsQueryParams>,
) -> impl Responder {
    let img_src = path.src.replacen("__", "", 2);
    let img_path = FACTORIO_DATA.join(img_src);

    let mut response = HttpResponse::Ok();

    let cache_control = header::CacheControl(vec![
        header::CacheDirective::Public,
        header::CacheDirective::MaxAge(600), // 10 min
    ]);
    response.set(cache_control);

    let (len, mtime) = match get_len_and_mtime(img_path.clone()).await {
        None => return util::not_found(),
        Some(data) => data,
    };

    if util::etag(&req, &mut response, format!("{:X}-{:X}", mtime, len)) {
        return response.finish();
    }

    let (buffer, format, (width, height)) = match get_image_data(img_path).await {
        None => return util::not_found(),
        Some(data) => data,
    };

    let content_type = match format {
        image::ImageFormat::Png => header::ContentType::png(),
        image::ImageFormat::Jpeg => header::ContentType::jpeg(),
        _ => return util::not_found(),
    };
    response.set(content_type);

    let x = query.x.min(width);
    let y = query.y.min(height);
    let w = query.w.unwrap_or(width).min(width - x);
    let h = query.h.unwrap_or(height).min(height - y);

    if x == 0 && y == 0 && w == width && h == height {
        return response.body(buffer);
    }

    use bytes::buf::BufMutExt;
    let mut writer = BytesMut::new().writer();
    let data = image::load_from_memory_with_format(&buffer, format)
        .map(|mut img| img.crop(x, y, w, h).write_to(&mut writer, format));

    match data {
        Ok(_) => response.body(writer.into_inner()),
        Err(_) => util::not_found(),
    }
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    #[cfg(feature = "dev")]
    dotenv::dotenv().ok();

    setup::setup(&DATA_DIR, &FACTORIO_DATA, FACTORIO_VERSION)
        .await
        .unwrap();
    let defines = setup::generate_defines(&DATA_DIR).await.unwrap();
    let bund = bundle::generate_bundle(defines, &FACTORIO_DATA)
        .await
        .unwrap();

    let data = AppState {
        client: reqwest::Client::new(),
        bundle: bund,
    };

    let mut server = HttpServer::new(move || {
        App::new()
            .data(data.clone())
            .service(_healthz)
            .service(_bundle)
            .service(_proxy)
            .service(_graphics)
            .default_service(web::to(|| util::not_found()))
    });

    #[cfg(feature = "dev")]
    let listener = listenfd::ListenFd::from_env().take_tcp_listener(0).unwrap();
    #[cfg(not(feature = "dev"))]
    let listener = None;

    server = if let Some(l) = listener {
        server.listen(l)?
    } else {
        server.bind("0.0.0.0:85")?
    };

    server.run().await
}
