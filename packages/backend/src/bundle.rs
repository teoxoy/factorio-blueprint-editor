use async_recursion::async_recursion;
use globset::GlobBuilder;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::path::{Path, PathBuf};

use super::util;

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

async fn generate_mod_locale(
    mod_name: &str,
    factorio_data: &PathBuf,
) -> Result<String, Box<dyn Error>> {
    let matcher = GlobBuilder::new(&format!("**/{}/locale/en/*.cfg", mod_name))
        .literal_separator(true)
        .build()?
        .compile_matcher();
    let paths = util::glob(factorio_data, &matcher).await?;
    let content = futures::future::try_join_all(paths.iter().map(|path| content_to_lines(&path)))
        .await?
        .concat()
        .join(",");
    Ok(format!("return {{{}}}", content))
}

struct Mods {
    modules: HashMap<String, HashMap<String, String>>,
    added: HashSet<(String, String)>,
    factorio_data: PathBuf,
}
impl Mods {
    fn new(factorio_data: PathBuf) -> Mods {
        Mods {
            modules: HashMap::new(),
            added: HashSet::new(),
            factorio_data,
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
        let content = generate_mod_locale(mod_name, &self.factorio_data).await;
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

        let module_path = self
            .factorio_data
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

pub async fn generate_bundle(
    defines: String,
    factorio_data: &PathBuf,
) -> Result<String, Box<dyn Error>> {
    let mut modules = Mods::new(factorio_data.clone());

    let serpent = include_str!("serpent.lua");
    modules.add("lualib", "serpent", serpent.to_string());
    modules.add("lualib", "defines", defines);
    let matcher = GlobBuilder::new("**/*.lua")
        .literal_separator(true)
        .build()?
        .compile_matcher();
    let factorio_lualib = factorio_data.join("core/lualib");
    for path in util::glob(&factorio_lualib, &matcher).await? {
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
