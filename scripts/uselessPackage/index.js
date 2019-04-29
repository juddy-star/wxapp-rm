const {
  resolve,
  getPackageDirList,
  fileDirListAsync,
  flatArray,
  filterCatalogList,
  filterExtList,
  rmDirAsync,
  rmDirListAsync,
  getChildDirListAsync,
  getCatalogDirList,
  getEntryFileDirList,
  getEntryFileDepDirListAsync,
  errorPackage,
} = require('./utils');

/**
 * 移除冗余的入口
 * 
 * 移除不在app.json中的主包和分包的入口目录(异步进行)
 *
 * 1. 找到app.json中的所有入口目录
 * 2. 遍历pages下的一级目录
 * 2.1 遍历后的一级目录，不包含入口目录，删除之并终止遍历； 等于入口目录，终止遍历
 * 2.2 递归遍历当前目录的二级目录，判断同上
 * 
 */
const rmExcludeConfigAsync = (packageDirList = [], dir = '') => {
  // 如果相等，则停止递归
  if (packageDirList.some(packageDir => packageDir === dir)) {
    return Promise.resolve();
  }
  // 如果不包含入口目录，删除该目录,停止递归
  if (packageDirList.every(packageDir => packageDir.indexOf(dir) === -1)) {
    return rmDirAsync(dir);
  }
  // 如果包含目录并且不等于入口目录
  if (packageDirList.some(packageDir => packageDir.indexOf(dir) > -1)) {
    // 读取该目录下的所有目录
    return getChildDirListAsync(dir)
      .then(getCatalogDirList)
      .then(rmExcludeConfigListAsync.bind(rmExcludeConfigListAsync, packageDirList));
  }
};

/**
 * 批量移除冗余的入口
 *
 * @param {*} packageDirList
 * @param {*} [dirList=[]]
 * @returns
 */
const rmExcludeConfigListAsync = (packageDirList, dirList = []) => {
  return Promise.all(dirList.map(dir => rmExcludeConfigAsync(packageDirList, dir)));
};

/**
 * 找到冗余的依赖
 * 1. 指定目录，component和pages
 * 2. 读取指定目录下的所有文件
 * 3. 读取入口文件的所有依赖，属于指定目录下的
 * 4. 属于2不属于3
 */
const getUselessDepListAsync = (catalogDirList = [resolve('component'), resolve('pages')]) => {
  // 读取指定目录下的所有文件
  const appointFileDirList = Promise.all(catalogDirList.map(fileDirListAsync))
    .then(flatArray)
    .then(filterExtList.bind(filterExtList, ['.wxml', '.js', '.wxss', '.json']))

  // 读取入口文件
  const entryFileDirList = getEntryFileDirList();

  // 读取入口文件的所有依赖，属于指定目录下的
  const entryFileDepDirListFromAppoint = getEntryFileDepDirListAsync()
    .then(filterCatalogList.bind(filterCatalogList, catalogDirList));

  /**
   * 属于1不属于2，之后不属于3的
   *
   */
  const filterUselessDepList = ([dirListFromAppoint = [], entryFileDirList = [], entryDepDirListFromAppoint = []] = []) => {
    return dirListFromAppoint
      .filter(dirFromAppoint => entryFileDirList.every(entryFileDir => dirFromAppoint !== entryFileDir))
      .filter(dirFromAppoint => entryDepDirListFromAppoint.every(entryDepDirFromAppoint => dirFromAppoint !== entryDepDirFromAppoint));
  };

  return Promise.all([appointFileDirList, entryFileDirList, entryFileDepDirListFromAppoint])
    .then(filterUselessDepList);
};

exports.rmExcludeConfigAsync = () => {
  return rmExcludeConfigAsync(getPackageDirList(), resolve('pages'));
}

exports.rmUselessDepListAsync = () => {
  return getUselessDepListAsync()
    .then(rmDirListAsync);
};

exports.handleErrorPackage = () => {
  if (errorPackage.hasError()) {
    errorPackage.log();
    return Promise.reject();
  }
  return Promise.resolve();
};