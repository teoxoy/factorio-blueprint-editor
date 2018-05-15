const execSync = require('child_process').execSync

const factorioDataDirectory = 'B:/SteamLibrary/steamapps/common/Factorio/data/'
const outputDirectory = '../src/'

process.chdir('./parser')

execSync(`node exportRawData.js ${factorioDataDirectory}`)
execSync(`node processRawData.js ${factorioDataDirectory} ${outputDirectory}`)
