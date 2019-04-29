# wxapp-gulp 微信小程序-移除冗余文件

## features

- 移除冗余的入口
- 入口文件进行分析，移除冗余的依赖(默认移除component文件夹和pages文件夹下的冗余文件)
- 支持所有文件格式的移除（自定义组件和一般文件）
- 完全异步执行，总耗时不超过2000ms
- 支持分析循环引用的情景
- 提供table展示，方便进行优化和错误统计
- 错误统计支持：依赖错误提示

## 命令

```js
npm start
```

## 目录

```js
scripts
├── errorPackage
│   └── index.js
├── executePerf
│   └── index.js
└── uselessPackage
    ├── index.js
    └── utils.js

dist                 -----打包后地址
├── app.json         -----小程序json文件
├── components       -----小程序compoents文件夹（例如存放公共template）
└── pages            -----小程序页面
    └── examples     -----其中一个页面
```