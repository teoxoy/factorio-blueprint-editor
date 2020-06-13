use async_compression::stream::LzmaDecoder;
use indicatif::{ProgressBar, ProgressStyle};
use serde::Deserialize;
use std::env;
use std::error::Error;
use std::ffi::OsStr;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Stdio;
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

pub async fn generate_defines(data_dir: &PathBuf) -> Result<String, Box<dyn Error>> {
    let scenario_path = data_dir.join("factorio/scenarios/gen-defines/control.lua");
    let defines_path = data_dir.join("factorio/script-output/defines.lua");
    let factorio_executable = data_dir.join("factorio/bin/x64/factorio");

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
pub async fn setup(
    data_dir: &PathBuf,
    factorio_data: &PathBuf,
    factorio_version: &str,
) -> Result<(), Box<dyn Error>> {
    let username = get_env_var!("FACTORIO_USERNAME")?;
    let token = get_env_var!("FACTORIO_TOKEN")?;

    let info_path = factorio_data.join("base/info.json");

    let same_version = get_info(info_path)
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

        // https://github.com/mitsuhiko/indicatif/issues/125
        // let mpb = MultiProgress::new();

        let d0 = download(
            get_download_url("alpha", factorio_version, &username, &token),
            data_dir,
            &["factorio/data/*"],
            /* mpb.add( */ ProgressBar::new(0),
        );
        let d1 = download(
            get_download_url("headless", factorio_version, &username, &token),
            data_dir,
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
