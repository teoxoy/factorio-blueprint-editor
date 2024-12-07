use async_recursion::async_recursion;
use globset::{GlobBuilder, GlobMatcher};
use indicatif::{ProgressBar, ProgressStyle};
use regex::Regex;
use serde::Deserialize;
use std::borrow::Cow;
use std::collections::HashMap;
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
        let mut buffer = std::io::Cursor::new(buffer);
        out.write_to(&mut buffer, format)?;

        let tmp_path = tmp_dir.join(path);
        tokio::fs::create_dir_all(tmp_path.parent().unwrap()).await?;
        tokio::fs::write(&tmp_path, &buffer.into_inner()).await?;
        Ok(Cow::Owned(tmp_path))
    } else {
        Ok(Cow::Borrowed(path))
    }
}

async fn content_to_lines(path: &Path) -> Result<String, Box<dyn Error>> {
    let file = tokio::fs::File::open(path).await?;
    let buf = tokio::io::BufReader::new(file);
    use tokio::io::AsyncBufReadExt;
    let mut lines_stream = buf.lines();

    let mut content = String::new();
    let mut group = String::new();
    while let Some(line) = lines_stream.next_line().await? {
        if line.is_empty() || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') {
            group = line[1..line.len() - 1].to_string();
            continue;
        }
        let Some(idx) = line.find('=') else { continue };
        let sep = match group.len() {
            0 => "",
            _ => ".",
        };
        let val = line[idx + 1..].to_string().replace("'", r"\'");
        let subgroup = &line[..idx];

        use std::fmt::Write;
        write!(&mut content, "['{group}{sep}{subgroup}']='{val}',")?;
    }

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

async fn generate_locale(factorio_data: &PathBuf) -> Result<String, Box<dyn Error>> {
    let matcher = GlobBuilder::new("**/*/locale/en/*.cfg")
        .literal_separator(true)
        .build()?
        .compile_matcher();
    let paths = glob(factorio_data, &matcher).await?;
    let content = futures::future::try_join_all(paths.iter().map(|path| content_to_lines(&path)))
        .await?
        .concat();
    Ok(format!("return {{{}}}", content))
}

pub async fn extract(output_dir: &Path, base_factorio_dir: &Path) -> Result<(), Box<dyn Error>> {
    let factorio_data = base_factorio_dir.join("data");
    let mod_dir = base_factorio_dir.join("mods/export-data");
    let scenario_dir = mod_dir.join("scenarios/export-data");
    let extracted_data_path = base_factorio_dir.join("script-output/data.json");
    let factorio_executable = base_factorio_dir.join("bin/x64/factorio");

    let info = include_str!("export-data/info.json");
    let script = include_str!("export-data/control.lua");
    let data = include_str!("export-data/data-final-fixes.lua");
    let locale = generate_locale(&factorio_data).await?;

    tokio::fs::create_dir_all(&scenario_dir).await?;
    tokio::fs::write(mod_dir.join("info.json"), info).await?;
    tokio::fs::write(mod_dir.join("locale.lua"), locale).await?;
    tokio::fs::write(mod_dir.join("data-final-fixes.lua"), data).await?;
    tokio::fs::write(scenario_dir.join("control.lua"), script).await?;

    println!("Generating defines.lua");

    Command::new(factorio_executable)
        .args(&["--start-server-load-scenario", "export-data/export-data"])
        .stdout(std::process::Stdio::null())
        .spawn()?
        .wait()
        .await?;

    let content = tokio::fs::read_to_string(&extracted_data_path).await?;
    tokio::fs::create_dir_all(&output_dir).await?;
    tokio::fs::write(output_dir.join("data.json"), &content).await?;

    let metadata_path = output_dir.join("metadata.json");

    let res = tokio::fs::read_to_string(&metadata_path).await;
    let old_metadata: HashMap<String, (u64, u64)> = match res {
        Ok(buffer) => serde_json::from_str(&buffer)?,
        Err(e) => match e.kind() {
            std::io::ErrorKind::NotFound => HashMap::new(),
            _ => return Err(Box::new(e)),
        },
    };
    let new_metadata = Arc::new(Mutex::new(HashMap::new()));

    lazy_static! {
        static ref IMG_REGEX: Regex = Regex::new(r#""([^"]+?\.png)""#).unwrap();
    }
    let file_paths: HashSet<String> = IMG_REGEX
        .captures_iter(&content)
        .map(|cap| cap[1].to_string())
        .collect();

    let file_paths = file_paths
        .into_iter()
        .map(|s| {
            let in_path =
                factorio_data.join(s.replace("__core__", "core").replace("__base__", "base"));
            let out_path = output_dir.join(s.replace(".png", ".basis").as_str());
            (in_path, out_path)
        })
        .collect::<Vec<(PathBuf, PathBuf)>>();

    let progress = ProgressBar::new(file_paths.len() as u64);
    progress.set_style(
        ProgressStyle::default_bar()
            .template("{wide_bar} {pos}/{len} ({elapsed})")
            .unwrap(),
    );

    let file_paths = Arc::new(Mutex::new(file_paths));

    let tmp_dir = std::env::temp_dir().join("__FBE__");
    tokio::fs::create_dir_all(&tmp_dir).await?;

    let available_parallelism =
        std::thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);

    futures::future::try_join_all((0..available_parallelism).map(|_| {
        compress_next_img(
            file_paths.clone(),
            &tmp_dir,
            progress.clone(),
            &old_metadata,
            new_metadata.clone(),
        )
    }))
    .await?;

    let new_metadata = {
        let new_metadata = new_metadata.lock().unwrap();
        serde_json::to_vec(&*new_metadata)?
    };
    tokio::fs::write(metadata_path, new_metadata).await?;

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

async fn compress_next_img(
    file_paths: Arc<Mutex<Vec<(PathBuf, PathBuf)>>>,
    tmp_dir: &Path,
    progress: ProgressBar,
    old_metadata: &HashMap<String, (u64, u64)>,
    new_metadata: Arc<Mutex<HashMap<String, (u64, u64)>>>,
) -> Result<(), Box<dyn Error>> {
    let get_paths = || file_paths.lock().unwrap().pop();
    while let Some((in_path, out_path)) = get_paths() {
        let (len, mtime) = get_len_and_mtime(&in_path).await?;
        let key = in_path.to_str().ok_or("PathBuf to &str failed")?;

        if old_metadata.get(key) == Some(&(len, mtime)) {
            new_metadata
                .lock()
                .unwrap()
                .insert(key.to_string(), (len, mtime));
        } else {
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
                .wait()
                .await?;

            if status.success() {
                new_metadata
                    .lock()
                    .unwrap()
                    .insert(key.to_string(), (len, mtime));
            } else {
                progress.println(format!("FAILED: {:?}", path));
            }
        }

        progress.inc(1);
    }

    Ok(())
}

// TODO: look into using https://wiki.factorio.com/Download_API
pub async fn download_factorio(
    data_dir: &Path,
    base_factorio_dir: &Path,
    factorio_version: &str,
) -> Result<(), Box<dyn Error>> {
    let info_path = base_factorio_dir.join("data/base/info.json");

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

        let username = get_env_var!("FACTORIO_USERNAME")?;
        let token = get_env_var!("FACTORIO_TOKEN")?;

        download(factorio_version, &username, &token, data_dir).await?;
    }

    Ok(())
}

async fn download(
    version: &str,
    username: &str,
    token: &str,
    out_dir: &Path,
) -> Result<(), Box<dyn Error>> {
    let os = match std::env::consts::OS {
        "linux" => "linux64",
        "windows" => "win64-manual",
        // "macos" => "osx",
        _ => panic!("unsupported OS"),
    };
    let url = format!("https://www.factorio.com/get-download/{version}/alpha/{os}?username={username}&token={token}");

    let client = reqwest::Client::new();
    let res = client.get(&url).send().await?;

    if !res.status().is_success() {
        panic!("Status code was not successful");
    }

    let pb = ProgressBar::new(0);

    let content_length = res.content_length();

    if let Some(content_length) = content_length {
        pb.set_length(content_length);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("[{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .unwrap()
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

    #[cfg(target_os = "windows")]
    {
        let mut bytes = if let Some(content_length) = content_length {
            Vec::with_capacity(content_length.try_into()?)
        } else {
            Vec::new()
        };
        let mut stream = stream;
        while let Some(chunk) = stream.try_next().await? {
            bytes.extend(chunk);
        }
        let mut ar = zip::ZipArchive::new(std::io::Cursor::new(bytes))?;
        ar.extract(out_dir)?;
    }
    #[cfg(target_os = "linux")]
    {
        let stream_reader = tokio_util::io::StreamReader::new(stream);
        let decompressor = async_compression::tokio::bufread::LzmaDecoder::new(stream_reader);

        let mut ar = tokio_tar::Archive::new(decompressor);
        ar.unpack(out_dir).await?;
    }

    pb.finish();

    Ok(())
}
