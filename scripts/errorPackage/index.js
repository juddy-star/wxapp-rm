const fs = require('fs');

module.exports = class ErrorPackage {
  constructor(options) {
    this.options = options;
    this.init();
  }
  init() {
    this.ErrorList = [];
  }
  push(errMap = {}) {
    const { fileDir = '', matchedStr = '', finallyDir = '' } = errMap;

    if (!this.ErrorList.some(error => error.fileDir === fileDir && error.matchedStr === matchedStr)) return;

    this.ErrorList.push(errMap);
  }
  formatFailDepList() {
    const genFormatFailDep = (failDep = {}) => {
      const { fileDir = '', matchedStr = '', finallyDir = '' } = failDep;

      return [chalk.blue(fileDir), chalk.red(matchedStr), finallyDir];
    };

    return this.ErrorList.map(genFormatFailDep);
  }
  log() {
    if (this.ErrorList.length === 0) return;

    console.log(chalk.magenta('失败依赖列表：'));

    console.log(table([['文件路径', '依赖字符串', '依赖文件路径'], ...this.formatFailDepList()]));
  }
  hasError() {
    return this.ErrorList.length > 0;
  }
  isErrorFile(fileDir = '') {
    return !fs.existsSync(fileDir);
  }
}