const chalk = require('chalk');
const {
  rmExcludeConfigAsync,
  rmUselessDepListAsync,
  handleErrorPackage
} = require('../uselessPackage');

const errLog = () => {
  console.log(chalk.red('请先处理以上异常，并重新执行npm start'));
};

rmExcludeConfigAsync()
  .then(rmUselessDepListAsync)
  .then(handleErrorPackage)
  .catch(errLog);
