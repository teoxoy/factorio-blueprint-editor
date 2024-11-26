use actix_web::{web, App, HttpResponse, HttpServer};
use std::path::PathBuf;

mod setup;

#[macro_use]
extern crate lazy_static;

static FACTORIO_VERSION: &str = "2.0.20";

lazy_static! {
    static ref DATA_DIR: PathBuf = PathBuf::from("./data");
    static ref FACTORIO_DATA: PathBuf = DATA_DIR.join("factorio/data");
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    #[cfg(feature = "dev")]
    dotenv::dotenv().ok();

    setup::download_factorio(&DATA_DIR, &FACTORIO_DATA, FACTORIO_VERSION)
        .await
        .unwrap();
    setup::extract(&DATA_DIR, &FACTORIO_DATA).await.unwrap();

    let mut server = HttpServer::new(move || {
        App::new()
            .service(actix_files::Files::new("/data", "./data/output").show_files_listing())
            .default_service(web::to(not_found))
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

fn not_found() -> HttpResponse {
    HttpResponse::NotFound()
        .content_type("text/plain")
        .body("404 Not Found")
}
