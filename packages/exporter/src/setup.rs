use async_compression::stream::LzmaDecoder;
use async_recursion::async_recursion;
use globset::{Glob, GlobSetBuilder};
use globset::{GlobBuilder, GlobMatcher};
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use regex::Regex;
use serde::Deserialize;
use std::borrow::Cow;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::{collections::HashSet, env};
use std::{error::Error, time::UNIX_EPOCH};
use tokio::process::Command;

macro_rules! get_env_var {
    ($name:expr) => {
        env::var($name).map_err(|_| format!("{} env variable is missing", $name))
    };
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

async fn get_info(path: &Path) -> Result<Info, Box<dyn Error>> {
    let contents = tokio::fs::read_to_string(path).await?;
    let p: Info = serde_json::from_str(&contents)?;
    Ok(p)
}

fn get_download_url(buid_type: &str, version: &str, username: &str, token: &str) -> String {
    format!(
        "https://www.factorio.com/get-download/{}/{}/linux64?username={}&token={}",
        version, buid_type, username, token
    )
}

#[allow(clippy::needless_lifetimes)]
async fn make_img_pow2<'a>(
    path: &'a Path,
    tmp_dir: &Path,
) -> Result<Cow<'a, Path>, Box<dyn Error>> {
    let (w, h) = image::image_dimensions(path)?;
    let w_log = f32::log2(w as f32);
    let h_log = f32::log2(h as f32);

    if w_log.fract() != 0.0 || h_log.fract() != 0.0 {
        let mut file = tokio::fs::File::open(path).await?;
        let len = file.metadata().await?.len();
        let mut buffer = Vec::with_capacity(len as usize);
        use tokio::io::AsyncReadExt;
        file.read_to_end(&mut buffer).await?;
        let format = image::guess_format(&buffer)?;
        let mut out = image::DynamicImage::new_rgba8(
            u32::pow(2, f32::ceil(w_log) as u32),
            u32::pow(2, f32::ceil(h_log) as u32),
        );
        let img = image::load_from_memory_with_format(&buffer, format)?;
        image::imageops::replace(&mut out, &img, 0, 0);
        buffer.clear();
        out.write_to(&mut buffer, format)?;

        let tmp_path = tmp_dir.join(path);
        tokio::fs::create_dir_all(tmp_path.parent().unwrap()).await?;
        tokio::fs::write(&tmp_path, &buffer).await?;
        Ok(Cow::Owned(tmp_path))
    } else {
        Ok(Cow::Borrowed(path))
    }
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

async fn generate_locale(factorio_data: &Path) -> Result<String, Box<dyn Error>> {
    let matcher = GlobBuilder::new("**/*/locale/en/*.cfg")
        .literal_separator(true)
        .build()?
        .compile_matcher();
    let paths = glob(factorio_data, &matcher).await?;
    let content = futures::future::try_join_all(paths.iter().map(|path| content_to_lines(&path)))
        .await?
        .concat()
        .join(",");
    Ok(format!("return {{{}}}", content))
}

pub async fn extract(data_dir: &Path, factorio_data: &Path) -> Result<(), Box<dyn Error>> {
    let output_dir = data_dir.join("output");
    let mod_dir = data_dir.join("factorio/mods/export-data");
    let scenario_dir = mod_dir.join("scenarios/export-data");
    let extracted_data_path = data_dir.join("factorio/script-output/data.json");
    let factorio_executable = data_dir.join("factorio/bin/x64/factorio");

    let info = include_str!("export-data/info.json");
    let script = include_str!("export-data/control.lua");
    let data = include_str!("export-data/data-final-fixes.lua");
    let locale = generate_locale(factorio_data).await?;

    tokio::fs::write(mod_dir.join("info.json"), info).await?;
    tokio::fs::write(mod_dir.join("locale.lua"), locale).await?;
    tokio::fs::write(mod_dir.join("data-final-fixes.lua"), data).await?;
    tokio::fs::write(scenario_dir.join("control.lua"), script).await?;

    println!("Generating defines.lua");
    Command::new(factorio_executable)
        .args(&["--start-server-load-scenario", "export-data/export-data"])
        .stdout(std::process::Stdio::null())
        .spawn()?
        .await?;

    let content = tokio::fs::read_to_string(&extracted_data_path).await?;
    tokio::fs::create_dir_all(&output_dir).await?;
    tokio::fs::write(output_dir.join("data.json"), &content).await?;
    let metadata_path = output_dir.join("metadata.yaml");
    let mut metadata_file = tokio::fs::OpenOptions::new()
        .read(true)
        .append(true)
        .create(true)
        .open(&metadata_path)
        .await?;
    use tokio::io::AsyncReadExt;
    let mut buffer = String::new();
    metadata_file.read_to_string(&mut buffer).await?;
    let obj: serde_yaml::Value = if buffer.is_empty() {
        serde_yaml::Value::Mapping(serde_yaml::mapping::Mapping::new())
    } else {
        serde_yaml::from_str(&buffer)?
    };
    let obj = Arc::new(Mutex::new(obj));
    lazy_static! {
        static ref IMG_REGEX: Regex = Regex::new(r#""([^"]+?\.png)""#).unwrap();
    }
    let iter: HashSet<String> = IMG_REGEX
        .captures_iter(&content)
        .map(|cap| cap[1].to_string())
        .collect();

    let mut file_paths = iter
        .into_iter()
        .map(|s| {
            let in_path =
                factorio_data.join(s.replace("__core__", "core").replace("__base__", "base").replace("__space-age__", "space-age").replace("__quality__", "quality").replace("__elevated-rails__", "elevated-rails"));
            let out_path = output_dir.join(s.replace(".png", ".basis").as_str());
            (in_path, out_path)
        })
        .collect::<Vec<(PathBuf, PathBuf)>>();

    file_paths.sort_unstable();
    let progress = ProgressBar::new(file_paths.len() as u64);
    progress.set_style(ProgressStyle::default_bar().template("{wide_bar} {pos}/{len} ({elapsed})"));

    let file_paths = Arc::new(Mutex::new(file_paths));
    let tmp_dir = std::env::temp_dir().join("__FBE__");
    tokio::fs::create_dir_all(&tmp_dir).await?;
    let metadata_file = Arc::new(tokio::sync::Mutex::new(metadata_file));
    futures::future::try_join_all((0..num_cpus::get()).map(|_| {
        compress_next_img(
            file_paths.clone(),
            &tmp_dir,
            progress.clone(),
            obj.clone(),
            metadata_file.clone(),
        )
    }))
    .await?;

    progress.finish();
    tokio::fs::remove_dir_all(&tmp_dir).await?;
    println!("DONE!");

    Ok(())
}

async fn get_len_and_mtime(path: &Path) -> Result<(u64, u64), Box<dyn Error>> {
    let file = tokio::fs::File::open(path).await?;
    let metadata = file.metadata().await?;
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|dur| dur.as_secs())
        .unwrap_or(0);
    Ok((metadata.len(), mtime))
}

#[async_recursion]
async fn compress_next_img(
    file_paths: Arc<Mutex<Vec<(PathBuf, PathBuf)>>>,
    tmp_dir: &Path,
    progress: ProgressBar,
    obj: Arc<Mutex<serde_yaml::Value>>,
    metadata_file: Arc<tokio::sync::Mutex<tokio::fs::File>>,
) -> Result<(), Box<dyn Error>> {
    let file_path = { file_paths.lock().unwrap().pop() };
    if let Some((in_path, out_path)) = file_path {
        let (len, mtime) = get_len_and_mtime(&in_path).await?;
        let key = in_path.to_str().ok_or("PathBuf to &str failed")?;
        let new_val = serde_yaml::to_value([len, mtime])?;

        let same = { obj.lock().unwrap()[key] == new_val };
        if !same {
            let path = make_img_pow2(&in_path, tmp_dir).await?;

            tokio::fs::create_dir_all(out_path.parent().unwrap()).await?;

            let basisu_executable = "./basisu";
            let status = Command::new(basisu_executable)
                // .args(&["-comp_level", "2"])
                .args(&["-no_multithreading"])
                // .args(&["-ktx2"])
                .args(&["-mipmap"])
                .args(&["-file", path.to_str().ok_or("PathBuf to &str failed")?])
                .args(&[
                    "-output_file",
                    out_path.to_str().ok_or("PathBuf to &str failed")?,
                ])
                .stdout(std::process::Stdio::null())
                .spawn()?
                .await?;

            if status.success() {
                let content = format!("\"{}\": [{}, {}]\n", key, len, mtime);
                use tokio::io::AsyncWriteExt;
                let mut file = metadata_file.lock().await;
                file.write_all(content.as_bytes()).await?;
            } else {
                println!("FAILED: {:?}", path);
            }
        }

        progress.inc(1);
    } else {
        return Ok(());
    }

    compress_next_img(file_paths, tmp_dir, progress, obj, metadata_file).await
}

// TODO: look into using https://wiki.factorio.com/Download_API
pub async fn download_factorio(
    data_dir: &Path,
    factorio_data: &Path,
    factorio_version: &str,
) -> Result<(), Box<dyn Error>> {
    let username = get_env_var!("FACTORIO_USERNAME")?;
    let token = get_env_var!("FACTORIO_TOKEN")?;

    let info_path = factorio_data.join("base/info.json");

    let same_version = get_info(&info_path)
        .await
        .map(|info| info.version == factorio_version)
        .unwrap_or(false);

    if same_version {
        println!("Downloaded Factorio version matches required version");
    } else {
        println!("Downloading Factorio v{}", factorio_version);
        if data_dir.is_dir() {
            tokio::fs::remove_dir_all(data_dir).await?;
        }
        tokio::fs::create_dir_all(data_dir).await?;

        let mpb = MultiProgress::new();

        let d0 = download(
            get_download_url("alpha", factorio_version, &username, &token),
            data_dir,
            &["factorio/data/*"],
            mpb.add(ProgressBar::new(0)),
        );
        let d1 = download(
            get_download_url("headless", factorio_version, &username, &token),
            data_dir,
            &["factorio/bin/*", "factorio/config-path.cfg"],
            mpb.add(ProgressBar::new(0)),
        );

        async fn wait_for_progress_bar(mpb: MultiProgress) -> Result<(), Box<dyn Error>> {
            tokio::task::spawn_blocking(move || mpb.join())
                .await?
                .map_err(Box::from)
        }

        tokio::try_join!(d0, d1, wait_for_progress_bar(mpb))?;
    }

    Ok(())
}

async fn download<I, S>(
    url: String,
    out_dir: &Path,
    filter: I,
    pb: ProgressBar,
) -> Result<(), Box<dyn Error>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
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

    let mut builder = GlobSetBuilder::new();
    for pattern in filter.into_iter() {
        builder.add(Glob::new(pattern.as_ref())?);
    }
    let matcher = builder.build()?;

    let stream_reader = decompressor.into_async_read();
    let ar = async_tar::Archive::new(stream_reader);
    let mut entries = ar.entries()?;
    use futures::stream::StreamExt;
    while let Some(Ok(mut file)) = entries.next().await {
        if matcher.is_match(file.path()?.to_path_buf()) {
            file.unpack_in(out_dir).await?;
        }
    }

    pb.finish();

    Ok(())
}
