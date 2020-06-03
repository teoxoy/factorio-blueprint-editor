use actix_web::{
    get, http, http::header, web, App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use async_compression::stream::LzmaDecoder;
use async_recursion::async_recursion;
use bytes::BytesMut;
use globset::{GlobBuilder, GlobMatcher};
use indicatif::{ProgressBar, ProgressStyle};
use regex::Regex;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::env;
use std::error::Error;
use std::ffi::OsStr;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::UNIX_EPOCH;
use tokio::process::Command;

#[macro_use]
extern crate lazy_static;

lazy_static! {
    static ref DATA_DIR: PathBuf = PathBuf::from("./data");
    static ref FACTORIO_DATA: PathBuf = DATA_DIR.join("factorio/data");
}

macro_rules! get_env_var {
    ($name:expr) => {
        env::var($name).map_err(|_| format!("{} env variable is missing", $name))
    };
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

#[get("/api/bundle")]
async fn bundle(data: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok()
        .content_type("application/json")
        .body(&data.bundle)
}

#[get("/api/proxy")]
async fn proxy(query: web::Query<ProxyQueryParams>, data: web::Data<AppState>) -> impl Responder {
    let error = |msg: String| HttpResponse::InternalServerError().body(msg);

    let res = match data.client.get(&query.url).send().await {
        Ok(res) => res,
        Err(e) => return error(e.to_string()),
    };

    let status_code = res.status();
    if !status_code.is_success() {
        return error(String::from("Status code was not successful"));
    }

    let mut response = HttpResponse::build(status_code);
    let content_type = res.headers().get(reqwest::header::CONTENT_TYPE);
    match content_type {
        Some(content_type) => response.content_type(content_type),
        None => response.content_type("text/plain; charset=UTF-8"),
    };
    match res.bytes().await {
        Ok(bytes) => response.body(bytes),
        Err(e) => error(e.to_string()),
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
    w: u32,
    #[serde(default)]
    h: u32,
}

struct MyBufimp {
    buf: BytesMut,
}

impl MyBufimp {
    pub fn with_capacity(capacity: usize) -> MyBufimp {
        MyBufimp {
            buf: BytesMut::with_capacity(capacity),
        }
    }
}

impl std::io::Write for MyBufimp {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.buf.extend(buf);
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn not_found() -> web::HttpResponse {
    HttpResponse::NotFound()
        .content_type("text/plain")
        .body("404 Not Found")
}

#[get("/api/graphics/{src:.*}")]
async fn graphics(
    req: HttpRequest,
    path: web::Path<GraphicsPathParams>,
    query: web::Query<GraphicsQueryParams>,
) -> impl Responder {
    let img_src = path.src.replacen("__", "", 2);
    let img_path = FACTORIO_DATA.join(img_src);

    let metadata = match tokio::fs::metadata(&img_path).await {
        Err(_e) => return not_found(),
        Ok(meta) => meta,
    };

    let mut response = HttpResponse::Ok();
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|dur| dur.as_secs())
        .unwrap_or(0);

    let cache_control = header::CacheControl(vec![
        header::CacheDirective::Public,
        header::CacheDirective::MaxAge(600),
    ]);
    response.set(cache_control);

    let etag = header::EntityTag::weak(format!("{:X}-{:X}", mtime, metadata.len()));
    response.set(header::ETag(etag));

    let existing_etag = req
        .headers()
        .get(header::IF_NONE_MATCH)
        .and_then(|val| val.to_str().ok())
        .unwrap_or("");

    use std::str::FromStr;
    let etags_match = header::EntityTag::from_str(existing_etag)
        .map(|etag| etag.weak_eq(&etag))
        .unwrap_or(false);

    if etags_match {
        return response.status(http::StatusCode::NOT_MODIFIED).finish();
    }

    let img_reader = match image::io::Reader::open(&img_path) {
        Ok(reader) => reader,
        Err(_e) => return not_found(),
    };

    let format = match img_reader.format() {
        Some(format) => format,
        None => return not_found(),
    };

    let ct = match format {
        image::ImageFormat::Png => header::ContentType::png(),
        image::ImageFormat::Jpeg => header::ContentType::jpeg(),
        _ => return not_found(),
    };

    response.set(ct);

    let mut img = match img_reader.decode() {
        Ok(img) => img,
        Err(_e) => return not_found(),
    };

    use image::GenericImageView;

    if query.w != 0
        && query.h != 0
        && (query.x != 0 || query.y != 0 || img.width() != query.w || img.height() != query.h)
    {
        img = img.crop(query.x, query.y, query.w, query.h);
    }

    let mut buf = MyBufimp::with_capacity(metadata.len() as usize);

    if let Err(_e) = img.write_to(&mut buf, format) {
        return not_found();
    }

    response.body(buf.buf)
}

#[async_recursion]
async fn glob(
    path: &Path,
    matcher: &GlobMatcher,
) -> Result<Vec<std::path::PathBuf>, Box<dyn Error>> {
    let mut entries = tokio::fs::read_dir(path).await?;
    let mut paths = Vec::<std::path::PathBuf>::new();

    while let Some(entry) = entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        let entry_path = entry.path();
        if file_type.is_file() && matcher.is_match(&entry_path) {
            paths.push(entry_path.clone())
        } else if file_type.is_dir() {
            let mut inner_paths = glob(&entry_path, matcher).await?;
            paths.append(&mut inner_paths);
        }
    }

    Ok(paths)
}

async fn content_to_lines(path: &Path) -> Result<Vec<String>, Box<dyn Error>> {
    let file = tokio::fs::File::open(path).await?;
    let buf = tokio::io::BufReader::new(file);
    use tokio::io::AsyncBufReadExt;
    use tokio::stream::StreamExt;
    let lines_stream = buf.lines();

    let mut group = String::new();
    let content = lines_stream
        .filter_map(|line| {
            let line = line.ok()?;
            if line.is_empty() || line.starts_with(';') {
                return None;
            }
            if line.starts_with('[') {
                group = line[1..line.len() - 1].to_string();
                return None;
            }
            let idx = line.find('=')?;
            let sep = match group.len() {
                0 => "",
                _ => ".",
            };
            let val = line[idx + 1..].to_string().replace("'", r"\'");
            let subgroup = &line[..idx];
            Some(format!("['{}{}{}']='{}'", group, sep, subgroup, val))
        })
        .collect()
        .await;
    Ok(content)
}

async fn generate_mod_locale(mod_name: &str) -> Result<String, Box<dyn Error>> {
    let matcher = GlobBuilder::new(&format!("**/{}/locale/en/*.cfg", mod_name))
        .literal_separator(true)
        .build()?
        .compile_matcher();
    let paths = glob(&FACTORIO_DATA, &matcher).await?;
    let content = futures::future::try_join_all(paths.iter().map(|path| content_to_lines(&path)))
        .await?
        .concat()
        .join(",");
    Ok(format!("return {{{}}}", content))
}

struct Mods {
    modules: HashMap<String, HashMap<String, String>>,
    added: HashSet<(String, String)>,
}
impl Mods {
    fn new() -> Mods {
        Mods {
            modules: HashMap::new(),
            added: HashSet::new(),
        }
    }
    fn add(&mut self, mod_name: &str, module_name: &str, content: String) {
        if !self.modules.contains_key(mod_name) {
            self.modules.insert(mod_name.to_string(), HashMap::new());
        }
        let modules = self.modules.get_mut(mod_name).unwrap();
        modules.insert(module_name.to_string(), content);
    }
    async fn add_path(&mut self, mod_name: &str, module_name: &str, module_path: &Path) {
        let content = tokio::fs::read_to_string(module_path).await;
        if let Ok(content) = content {
            self.add(mod_name, module_name, content)
        }
    }
    async fn add_locale(&mut self, mod_name: &str) {
        let content = generate_mod_locale(mod_name).await;
        if let Ok(content) = content {
            self.add(mod_name, &"__locale__", content)
        }
    }

    #[async_recursion]
    async fn process_module(&mut self, mod_name: &str, module_name: &str) {
        let tuple = (mod_name.to_string(), module_name.to_string());
        if self.added.contains(&tuple) {
            return;
        } else {
            self.added.insert(tuple);
        }

        let module_path = FACTORIO_DATA
            .join(mod_name)
            .join(module_name.replace(".", "/"))
            .with_extension("lua");
        let content = match tokio::fs::read_to_string(module_path).await {
            Ok(content) => content,
            Err(_) => return,
        };

        lazy_static! {
            static ref RE: Regex = Regex::new(r#"require\s*\(?['"](.+?)['"]\)?"#).unwrap();
        }
        let iter: Vec<String> = RE
            .captures_iter(&content)
            .map(|cap| cap[1].to_string())
            .collect();

        for req_module_name in iter {
            self.process_module(mod_name, &req_module_name).await;
        }

        self.add(mod_name, &module_name, content);
    }
}

async fn generate_bundle(defines: String) -> Result<String, Box<dyn Error>> {
    let mut modules = Mods::new();

    let serpent = include_str!("serpent.lua");
    modules.add("lualib", "serpent", serpent.to_string());
    modules.add("lualib", "defines", defines);
    let matcher = GlobBuilder::new("**/*.lua")
        .literal_separator(true)
        .build()?
        .compile_matcher();
    let factorio_lualib = FACTORIO_DATA.join("core/lualib");
    for path in glob(&factorio_lualib, &matcher).await? {
        let module_name = path
            .strip_prefix(&factorio_lualib)?
            .with_extension("")
            .iter()
            .map(|part| part.to_str().unwrap())
            .collect::<Vec<&str>>()
            .join(".");

        modules.add_path("lualib", &module_name, &path).await;
    }

    let vanilla_mods = vec!["core", "base"];
    // https://lua-api.factorio.com/latest/Data-Lifecycle.html
    let entry_points = vec!["data", "data-updates", "data-final-fixes"];

    for mod_name in vanilla_mods {
        for module_name in &entry_points {
            modules.process_module(mod_name, module_name).await;
        }
        modules.add_locale(mod_name).await;
    }

    let out = serde_json::to_string(&modules.modules)?;

    Ok(out)
}

#[derive(Deserialize)]
struct Info {
    // name: String,
    version: String,
    // title: String,
    // author: String,
    // contact: String,
    // homepage: String,
    // dependencies: Vec<String>,
}

fn get_info<P: AsRef<Path>>(path: P) -> Result<Info, Box<dyn Error>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let p: Info = serde_json::from_reader(reader)?;
    Ok(p)
}

fn get_download_url(buid_type: &str, version: &str, username: &str, token: &str) -> String {
    format!(
        "https://www.factorio.com/get-download/{}/{}/linux64?username={}&token={}",
        version, buid_type, username, token
    )
}

async fn generate_defines() -> Result<String, Box<dyn Error>> {
    let scenario_path = DATA_DIR.join("factorio/scenarios/gen-defines/control.lua");
    let defines_path = DATA_DIR.join("factorio/script-output/defines.lua");
    let factorio_executable = DATA_DIR.join("factorio/bin/x64/factorio");

    let scenario_script = "
script.on_init(function()
    game.write_file('defines.lua', 'return '..serpent.block(_G.defines), false, 0)
    error(\"!EXIT!\")
end)";

    tokio::fs::create_dir_all(scenario_path.parent().unwrap()).await?;
    tokio::fs::write(scenario_path, scenario_script).await?;

    println!("Generating defines.lua");

    Command::new(factorio_executable)
        .args(&["--start-server-load-scenario", "gen-defines"])
        .spawn()?
        .await?;

    let content = tokio::fs::read_to_string(&defines_path).await?;
    tokio::fs::remove_file(defines_path).await?;

    Ok(content)
}

// TODO: look into using https://wiki.factorio.com/Download_API
async fn setup() -> Result<(), Box<dyn Error>> {
    let username = get_env_var!("FACTORIO_USERNAME")?;
    let token = get_env_var!("FACTORIO_TOKEN")?;
    let version = get_env_var!("FACTORIO_VERSION")?;

    let info_path = FACTORIO_DATA.join("base/info.json");

    let same_version = get_info(info_path)
        .map(|info| info.version == version)
        .unwrap_or(false);

    if same_version {
        println!("Downloaded Factorio version matches required version");
    } else {
        println!("Downloading Factorio v{}", version);
        if DATA_DIR.is_dir() {
            tokio::fs::remove_dir_all(&*DATA_DIR).await?;
        }
        tokio::fs::create_dir_all(&*DATA_DIR).await?;

        // https://github.com/mitsuhiko/indicatif/issues/125
        // let mpb = MultiProgress::new();

        let d0 = download(
            get_download_url("alpha", &version, &username, &token),
            &*DATA_DIR,
            &["factorio/data/*"],
            /* mpb.add( */ ProgressBar::new(0),
        );
        let d1 = download(
            get_download_url("headless", &version, &username, &token),
            &*DATA_DIR,
            &["factorio/bin/*", "factorio/config-path.cfg"],
            /* mpb.add( */ ProgressBar::new(0),
        );

        // mpb.join()?;

        tokio::try_join!(d0, d1)?;
    }

    Ok(())
}

async fn download<I, S, O>(
    url: String,
    out_dir: &O,
    filter: I,
    pb: ProgressBar,
) -> Result<(), Box<dyn Error>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
    O: AsRef<OsStr>,
{
    let client = reqwest::Client::new();
    let res = client.get(&url).send().await?;

    if !res.status().is_success() {
        panic!("Status code was not successful");
    }

    if let Some(content_length) = res.content_length() {
        pb.set_length(content_length);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("[{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .progress_chars("=> "),
        );
    } else {
        pb.set_style(ProgressStyle::default_spinner());
    }

    use futures::stream::TryStreamExt;
    let stream = res
        .bytes_stream()
        .map_err(|e| futures::io::Error::new(futures::io::ErrorKind::Other, e));

    let stream = stream.inspect_ok(|chunk| {
        pb.inc(chunk.len() as u64);
    });

    let decompressor = LzmaDecoder::new(stream);
    let mut stream_reader = tokio::io::stream_reader(decompressor);

    let mut tar_cmd = Command::new("tar")
        .arg("--extract")
        .arg("--totals")
        .arg("-C")
        .arg(out_dir)
        .args(&["--wildcards-match-slash", "--wildcards"])
        .args(filter)
        .stdin(Stdio::piped())
        .spawn()?;

    {
        let mut stdin = tar_cmd.stdin.take().ok_or("Failed to open stdin")?;
        tokio::io::copy(&mut stream_reader, &mut stdin).await?;
    }

    if !tar_cmd.await?.success() {
        return Err("tar failed".into());
    }

    pb.finish();

    Ok(())

    // https://github.com/dignifiedquire/async-tar/issues/5

    // let stream_reader = decompressor.into_async_read();
    // let mut ar = async_tar::Archive::new(stream_reader);
    // let mut entries = ar.entries()?;
    // use futures::stream::StreamExt;
    // while let Some(Ok(mut file)) = entries.next().await {
    //     if file
    //         .path()?
    //         .to_str()
    //         .map(|path| path.starts_with("factorio/bin/") || path == "factorio/config-path.cfg")
    //         .unwrap_or(false)
    //     {
    //         file.unpack_in(Path::new(out_dir)).await?;
    //     }
    // }

    // let mut ar = tokio_tar::Archive::new(stream_reader);
    // let mut entries = ar.entries()?;
    // use futures::stream::StreamExt;
    // while let Some(Ok(mut file)) = entries.next().await {
    //     if file
    //         .path()?
    //         .to_str()
    //         .map(|path| path.starts_with("factorio/bin/") || path == "factorio/config-path.cfg")
    //         .unwrap_or(false)
    //     {
    //         file.unpack_in(Path::new(out_dir)).await?;
    //     }
    // }
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    #[cfg(feature = "dev")]
    dotenv::dotenv().ok();

    setup().await.unwrap();
    let defines = generate_defines().await.unwrap();
    let bund = generate_bundle(defines).await.unwrap();

    let data = AppState {
        client: reqwest::Client::new(),
        bundle: bund,
    };

    let mut server = HttpServer::new(move || {
        App::new()
            .data(data.clone())
            .service(bundle)
            .service(proxy)
            .service(graphics)
            .default_service(web::to(|| not_found()))
    });

    #[cfg(feature = "dev")]
    let listener = listenfd::ListenFd::from_env().take_tcp_listener(0).unwrap();
    #[cfg(not(feature = "dev"))]
    let listener = None;

    server = if let Some(l) = listener {
        server.listen(l)?
    } else {
        server.bind("0.0.0.0:80")?
    };

    server.run().await
}
