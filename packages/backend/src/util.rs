use actix_web::{
    dev::HttpResponseBuilder, http::header, http::StatusCode, HttpRequest, HttpResponse,
};
use async_recursion::async_recursion;
use globset::GlobMatcher;
use std::error::Error;
use std::path::Path;

pub fn not_found() -> HttpResponse {
    HttpResponse::NotFound()
        .content_type("text/plain")
        .body("404 Not Found")
}

/// Attaches the given ETAG to the response
///
/// Returns `true` if request ETAG is the same as current ETAG
pub fn etag(req: &HttpRequest, res: &mut HttpResponseBuilder, etag: String) -> bool {
    let etag = header::EntityTag::weak(etag);

    let existing_etag = req
        .headers()
        .get(header::IF_NONE_MATCH)
        .and_then(|val| val.to_str().ok())
        .unwrap_or("");

    use std::str::FromStr;
    let etags_match = header::EntityTag::from_str(existing_etag)
        .map(|existing_etag| existing_etag.weak_eq(&etag))
        .unwrap_or(false);

    res.set(header::ETag(etag));

    if etags_match {
        res.status(StatusCode::NOT_MODIFIED);
    }

    etags_match
}

#[async_recursion]
pub async fn glob(
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
