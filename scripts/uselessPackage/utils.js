// file table overflow
// $ echo kern.maxfiles=65536 | sudo tee -a /etc/sysctl.conf
// $ echo kern.maxfilesperproc=65536 | sudo tee -a /etc/sysctl.conf
// $ sudo sysctl -w kern.maxfiles=65536
// $ sudo sysctl -w kern.maxfilesperproc=65536
// $ ulimit -n 65536


const path = require('path');
const blueBird = require('bluebird');
const fs = blueBird.promisifyAll(require('fs'));

/*eslint-disable global-require */
const errorPackage = new (require('../errorPackage'))();
/*eslint-enable global-require */

const cwd = process.cwd();
const executeDir = 'dist';

/**
 * 起始路径为process.cwd()的绝对路径
 *
 * @returns
 */
const resolve = function () {
  return path.resolve.apply(path, [cwd, executeDir, ...arguments]);
};

const defaultEntryFileList = [resolve('app.js'), resolve('app.wxss')];

/* eslint-disable import/no-dynamic-require */
const config = require(resolve('app.json'));

/**
 * 拿到主包和分包的所有绝对路径
 *
 * @returns
 */
const getPackageDirList = () => {
  const {
    pages = [], subPackages = []
  } = config;
  const mainPackageDirList = pages.map(filePath => resolve(path.dirname(filePath)));
  const subPackageDirList = subPackages.map(subPackage => resolve(subPackage.root));

  return [...mainPackageDirList, ...subPackageDirList];
};

/**
 * 获得所有页面的所属目录
 *
 */
const getPageCatalogDirList = () => {
  const {
    pages = [], subPackages = []
  } = config;
  const mainPagesCatalogDirList = pages.map(filePath => resolve(path.dirname(filePath)));

  /**
   * 生成所有分包的页面的目录
   *
   * @param {*} [sPCDirList=[]]
   * @param {*} [subPackage={}]
   * @returns
   */
  const genSPCDirList = (sPCDirList = [], subPackage = {}) => {
    const { root: subPackageRoot = '', pages: subPackagePages = [] } = subPackage;

    /**
     * 生成单个分包的页面的目录
     *
     * @param {*} [sPCDirList=[]]
     * @param {string} [subPackagePage='']
     */
    const genSPPCDirList = (sPCDirList = [], subPackagePage = '') => 
      [...sPCDirList, path.dirname(resolve(subPackageRoot, subPackagePage))];

    return subPackagePages.reduce(genSPPCDirList, sPCDirList);
  };

  const subPagesCatalogDirList = subPackages.reduce(genSPCDirList, []);
  return [...mainPagesCatalogDirList, ...subPagesCatalogDirList];
};

/**
 * 把dir装饰城绝对路径
 *
 * @param {string} [catalogDir='']
 * @param {string} [dirNameList='']
 */
const decorateDirList = (catalogDir = '', dirNameList = '') => dirNameList.map(dirName => resolve(catalogDir, dirName));

/**
 * 是否是目录
 *
 * @param {string} [dir='']
 * @returns
 */
const isDirectory = (dir = '') => fs.statSync(dir).isDirectory();

/**
 * 是否是文件
 *
 * @param {string} [dir='']
 * @returns
 */
const isFile = (dir = '') => fs.statSync(dir).isFile();

/**
 * 该目录下的所有目录 第一层
 *
 * @param {string} [dir='']
 * @returns
 */
const getChildDirListAsync = (catalogDir = '') => {
  return fs.readdirAsync(catalogDir)
    .then(decorateDirList.bind(decorateDirList, catalogDir));
}

const getCatalogDirList = (dirList = []) => dirList.filter(isDirectory);

const rmDirAsync = (dir = '') => {
  /**
   * 删除当前目录的子孙
   *
   * @param {*} [childDirList=[]]
   * @returns
   */
  const rmChildDirList = (childDirList = []) => {
    return Promise.all(childDirList.map(childDir => rmDirAsync(childDir)));
  };

  /**
   * 删除当前目录
   *
   */
  const rmDir = () => fs.rmdirAsync(dir);

  if (isFile(dir)) return fs.unlinkAsync(dir);

  return fs.readdirAsync(dir)
    .then(decorateDirList.bind(decorateDirList, dir))
    .then(rmChildDirList)
    .then(rmDir);
};

/**
 * 批量删除文件或目录
 *
 * @param {*} [dirList=[]]
 * @returns
 */
const rmDirListAsync = (dirList = []) => {
  return Promise.all(dirList.map(dir => rmDirAsync(dir)));
};

/**
 * 获得当前目录下的所有文件的绝对路径，平铺
 *
 * @param {string} [dir='']
 */
const fileDirListAsync = (dir = '') => {
  if (isFile(dir)) return dir;

  return getChildDirListAsync(dir).map(childDir => fileDirListAsync(childDir));
};

/**
 * 平铺数组
 *
 * @param {*} [list=[]]
 * @returns
 */
const flatArray = (list = []) => {
  if (!Array.isArray(list)) return [list];

  return list.reduce((result, item) => {
    return [...result, ...flatArray(item)];
  }, []);
};

/**
 * 通过后缀，过滤文件
 *
 * @param {*} [whiteExtList=[]]
 * @param {*} [fileDirList=[]]
 * @returns
 */
const filterExtList = (whiteExtList = [], fileDirList = []) => {
  return fileDirList.filter(fileDir => whiteExtList.some(whiteExt => whiteExt === path.extname(fileDir)));
};

/**
 * 通过目录，过滤文件
 *
 * @param {string} [whiteCatalogDirList=[resolve('component')]]
 * @param {*} [depFileDirList=[]]
 * @returns
 */
const filterCatalogList = (whiteCatalogDirList = [resolve('component')], depFileDirList = []) => {
  return depFileDirList.filter(depFileDir => whiteCatalogDirList.some(whiteCatalogDir => depFileDir.indexOf(whiteCatalogDir) > -1));
}

/**
 * 拿到所有页面的文件路径
 *
 * 1. .wxml
 * 2. .js
 * 3. .wxss
 * 4. .json
 * 
 */
const getPageFileDirList = () => {
  const {
    pages: mainPages = [], subPackages = []
  } = config;

  /**
   * 通过入口文件（不带后缀），生成四种带后缀的文件
   *
   * @param {*} [fileDirList=[]]
   * @param {string} [fileDirNoExt='']
   * @returns
   */
  const genFileDirList = (fileDirList = [], fileDirNoExt = '') => {
    const unitFileDirList = ['.wxml', '.js', '.wxss', '.json']
      .map(ext => `${fileDirNoExt}${ext}`)
      .filter(fileDir => fs.existsSync(fileDir))

    return [...fileDirList, ...unitFileDirList];
  }

  const mainPageFileDirList = mainPages
    .map(mainPage => resolve(mainPage))
    .reduce(genFileDirList, []);

  /**
   * 生成分包的所有页面的四种后缀的文件
   *
   * @param {*} [sPFDirList=[]]
   * @param {*} [subPackage={}]
   * @returns
   */
  const genSPFDirList = (sPFDirList = [], subPackage = {}) => {
    const { root: subPackageRoot = '', pages: subPackagePages = [] } = subPackage;

    return subPackagePages
      .map((subPackagePage) => resolve(subPackageRoot, subPackagePage))
      .reduce(genFileDirList, sPFDirList);
  };

  const subPageFileDirList = subPackages.reduce(genSPFDirList, []);

  return [...mainPageFileDirList, ...subPageFileDirList];
};

/**
 * 获取所有的入口文件的绝对路径（pages目录下的所有入口文件，以及app.js和app.wxss）
 * 
 * 1. pages目录下
 * 2. app.js
 * 3. app.wxss
 * 
 */
const getEntryFileDirList = () => {
  return [...getPageFileDirList(), ...defaultEntryFileList];
};

// 三种文件格式的import验证规则
const regulars = {
  '.wxml': /<import src=["']([\w./-/$]+)["']/,
  '.wxss': /@import ["']([\w./-/$]+)["']/,
  // 兼容es6和es5的语法，不支持AMD的格式
  '.js': /(?:import(?:.+from)? ["']([\w./-/$]+)["'])|(?:require\(["']([\w./-/$]+)["']\))/
};

/**
 * 是否是第三方包
 * 
 * 不带 ../ ./ /的认为是第三方包
 *
 * @param {*} ext
 * @param {*} matchedStr
 * @returns
 */
const isNodeModules = (ext, matchedStr) => {
  if (!/(\.){0,2}\//.test(matchedStr) && ext === '.js') return true;
};

/**
 * 解析json文件
 * 1. 如果usingComponents字段有内容，则视作依赖文件
 *
 * @param {*} ext
 * @param {*} fileDir
 * @param {*} file
 */
const getDepFileDirListByACC = (ext, fileDir) => {
  if (ext !== '.json') return [];

  /*eslint-disable global-require */ 
  const file = require(fileDir);
  /*eslint-enable global-require */ 

  const { usingComponents = {} } = file;
  if (Object.keys(usingComponents).length === 0) return [];

  const genUsingComponents = (depFileDirList = [], componentKey = '') => {
    const componentValue = usingComponents[componentKey];
    
    // 如果是相对地址, 不带/的，默认为相对地址
    let componentDirNoExt = resolve(path.dirname(fileDir), componentValue);

    // 如果是绝对地址, 开头带/的
    if (path.isAbsolute(componentValue)) componentDirNoExt = resolve(componentValue.slice(1));

    const unitFileDirList = ['.wxml', '.js', '.wxss', '.json']
      .map(ext => `${componentDirNoExt}${ext}`)
      .filter(fileDir => fs.existsSync(fileDir)) 

    return [...depFileDirList, ...unitFileDirList];
  };

  return Object.keys(usingComponents)
    .reduce(genUsingComponents, []);  
}

/**
 * 解析常规文件获得依赖
 * 1. .wxml
 * 2. .wxss
 * 3. .js
 *
 * @param {*} file
 */
const getDepFileDirListByACommon = (ext, fileDir, file) => {
  if (Object.keys(regulars).every(regularKey => regularKey !== ext)) throw new Error(`can't analysis this ext: ${ext}`);
  // 拿到当前的后缀
  const matched = file.match(new RegExp(regulars[ext], 'gm')) || [];

  if (matched.length === 0) return [];

  /**
   * 处理匹配到的数据
   * 1. 判断是第三方包，绝对路径还是相对路径
   * 2. 补充后缀
   *
   * @param {string} [matchStr='']
   * @returns
   */
  const executeMatched = (matchStr = '') => {
    const matchedList = matchStr.match(new RegExp(regulars[ext]));
    const matchedStr = matchedList[1] || matchedList[2];

    // 如果是第三方包 不带 ../ ./ /的认为是第三方包
    if (isNodeModules(ext, matchedStr)) return '';

    // 如果是相对地址, 不带/的，默认为相对地址
    let matchedDir = resolve(path.dirname(fileDir), matchedStr);

    // 如果是绝对地址, 开头带/的
    if (path.isAbsolute(matchedStr)) matchedDir = resolve(matchedStr.slice(1));


    // 加后缀
    const parsedDir = path.parse(matchedDir);
    if (!parsedDir.ext) parsedDir.base += ext;

    const finallyDir = path.format(parsedDir);

    if (errorPackage.isErrorFile(finallyDir)) {
      errorPackage.push({
        fileDir,
        matchStr,
        finallyDir
      });
      return '';
    }

    // 重新组装
    return finallyDir;
  };

  /**
   * 删除空的匹配
   *
   * @param {string} [matchedDir='']
   */
  const rmBlankMathed = (matchedDir = '') => !!matchedDir;

  return matched
    .map(executeMatched)
    .filter(rmBlankMathed)
};
/**
 * 解析文件获得的依赖文件
 * 1. .json文件格式
 * 2. .wxml .js .wxss文件格式
 *
 * @param {*} file
 */
const getDepFileDirListByAnalysis = (ext, fileDir, file) => {
  if (ext === '.json') return getDepFileDirListByACC(ext, fileDir);

  return getDepFileDirListByACommon(ext, fileDir, file);
};

/**
 * 获取当前文件的所有依赖的绝对路径
 */
const getDepFileDirListAsync = (depFileDirListCache = [], fileDir = '') => {
  let globalDepFileDirList = [];

  /**
   * 加工依赖文件绝对路径
   *
   */
  const executeDepFileDirList = (depFileDirList = []) => {
    // 从depFileDirList中筛选出depFileDirListCache中没有的绝对路径
    const newDepFileDirList = depFileDirList.filter(depFileDir => depFileDirListCache.every(depFileDirCache => depFileDirCache !== depFileDir));

    // 把newDepFileDirList存进cache中
    newDepFileDirList.forEach((newDepFileDir) => {
      depFileDirListCache.push(newDepFileDir);
    });

    // 先保存
    globalDepFileDirList = newDepFileDirList;
    // 再递归拿到下一层的依赖文件
    return getAllDepFileDirListAsync(depFileDirListCache, newDepFileDirList);
  }

  const unionArray = (arr) => Array.from(new Set([...globalDepFileDirList, ...arr]))

  return fs.readFileAsync(fileDir, 'utf-8')
    .then(getDepFileDirListByAnalysis.bind(getDepFileDirListByAnalysis, path.extname(fileDir), fileDir))
    .then(executeDepFileDirList)
    .then(flatArray)
    .then(unionArray);
};

/**
 * 批量获取当前文件的所有依赖的绝对路径
 *
 * @param {*} [fileDirList=[]]
 */
const getAllDepFileDirListAsync = (depFileDirListCache = [], fileDirList = []) => Promise.all(fileDirList.map(fileDir => getDepFileDirListAsync(depFileDirListCache, fileDir)));


/**
 * 得到入口文件的所有依赖列表  异步
 * 只拿到.wxml .js .wxss文件(这些文件为有效文件)
 *
 * @returns
 */
const getEntryFileDepDirListAsync = () => {
  return getAllDepFileDirListAsync([], getEntryFileDirList())
    .then(flatArray);
};

/**
 * 拿到自定义组件的.wxml .wxss .js文件
 *
 * @param {*} [jsonFileDirList=[]]
 * @returns
 */
const executeCustomCompFileDir = (jsonFileDirList = []) => {
  /**
   * 核心转换功能
   *
   * @param {string} [jsonFileDir='']
   * @returns
   */
  const generateFileDirList = (jsonFileDir = '') => {
    const catalogDir = path.dirname(jsonFileDir);

    return fs.readdirAsync(catalogDir)
      .then(decorateDirList.bind(decorateDirList, catalogDir))
      .then(filterExtList.bind(filterExtList, ['.wxml', '.wxss', '.js']))
  };


  return Promise.all(
      jsonFileDirList
      .map(generateFileDirList))
    .then(flatArray);
};

/**
 * 筛选出来是自定义组件的json文件的绝对路径列表
 *
 * @param {*} [jsonFileDirList=[]]
 */
const filterCustomCompJsonFileDirList = (jsonFileDirList = []) => {
  /*eslint-disable global-require */
  return jsonFileDirList.filter((jsonFileDir = '') => !!((require(jsonFileDir)).component));
  /*eslint-enable global-require */
};

/**
 * 拿到是自定义组件的所有文件
 * 
 * 目前只是拿component目录下的
 * 
 * @returns
 */
const getCustomCompFileDirListAsync = (whiteCatalogDir = resolve('component')) => {
  return fileDirListAsync(whiteCatalogDir)
    .then(flatArray)
    .then(filterExtList.bind(filterExtList, ['.json']))
    .then(filterCustomCompJsonFileDirList)
    .then(executeCustomCompFileDir)
}

exports.resolve = resolve;

exports.getPackageDirList = getPackageDirList;

exports.getPageCatalogDirList = getPageCatalogDirList;

exports.fileDirListAsync = fileDirListAsync;

exports.flatArray = flatArray;

exports.filterCatalogList = filterCatalogList;

exports.filterExtList = filterExtList;

exports.rmDirAsync = rmDirAsync;

exports.rmDirListAsync = rmDirListAsync;

exports.getChildDirListAsync = getChildDirListAsync;

exports.getCatalogDirList = getCatalogDirList;

exports.getEntryFileDirList = getEntryFileDirList;

exports.getEntryFileDepDirListAsync = getEntryFileDepDirListAsync;

exports.getCustomCompFileDirListAsync = getCustomCompFileDirListAsync;

exports.errorPackage = errorPackage;