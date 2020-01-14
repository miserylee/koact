# koact

##  ![NPM version](https://img.shields.io/npm/v/koact.svg?style=flat)


### 这是什么？

`koact`是一个便捷的`koa`应用的路由管理器。

### 怎么使用？

```js
// 使用 yarn 或 npm 安装 koact
import koact from 'koact';
import * as Koa from 'koa';

const app = new Koa();

const router = koact(path.resolve(__dirname, 'routes'));

koa.use(router);
koa.listen(3000);
```

路由文件放在上面代码指定的`routes`文件夹下即可。

`koact`函数的具体定义如下：

```js
export interface IOptions {
    resolves?: string[]; // 指定ext的文件将会被解析，默认值为['.js', '.ts', '.node']
    docSecret?: string; // 指定接口文档的访问密钥，默认无密钥，可随意访问
}
/*
routesPath: 路由文件所在的文件夹
enhancers: 全局的路由增强器
options: 额外的配置，见IOptions
*/
declare const koact: (routesPath: string, enhancers?: Enhancer[] | undefined, options?: IOptions) => compose.Middleware<Context>;
```

### 怎么写路由文件？

每一个路由文件即代表一个API模块，其相对于`routes`的路径即为`pathname`；

文件名的格式为`<method>[.version]#<api name>.js|ts`；

例如： `routes/userInfo/GET#获取账户信息.ts` 表示接口`pathname=/userInfo method=GET version=default 接口名=获取账户信息`；

若文件路径中包含了`#param`的部分，则会被解析为`params`参数；

**注意：若文件名以 _ 开头，则认为该文件是非路由文件，会被解析器忽略。**

在路由文件内`export default`一个类型为`IAPI`的模块即可自动解析为API接口，`IAPI`类型的定义如下：

```js
export interface IObject {
  [key: string]: any;
}

export type APIHandler<P, Q, B, R> = (data: { params: P, query: Q, body: B, ctx: Context, next: () => Promise<void> }) => Promise<R>; // 对接口业务函数的定义

export interface IAPIBase<P = any, Q = any, B = any, R = any> extends IObject {
  params?: IObject; // 对params进行校验的数据结构模板
  query?: IObject; // 对query进行校验的数据结构模板
  body?: IObject; // 对body进行校验的数据结构模板
  res?: any; // 对返回值responseBody进行数据结构校验的模板
  handler?: APIHandler<P, Q, B, R>; // 接口执行函数
  pre?: Middleware[]; // 该接口适用的koa中间件
  useCustomBodyParser?: boolean; // 标记是否适用自定义的bodyParser模块，适用自定义bodyParser模块时，koact会忽略内置的bodyParser，所以必须在前置中间件中加入自定义的bodyParser模块才可以对body数据进行解析
}

// 对接口增强器的定义，增强器用于在运行时对接口定义进行改写
export type Enhancer = (api: IAPIBase, info: { method: string, name: string, path: string }) => IAPIBase;

// IAPI 的类型定义
export interface IAPI<P = any, Q = any, B = any, R = any> extends IAPIBase<P, Q, B, R> {
  enhancers?: Enhancer[]; // 该接口的增强器
}
```

其中对参数和返回值进行数据校验的数据结构模板，使用了`schema.io`库来进行。在这里[schema.io](https://github.com/miserylee/schema.io)查看具体使用方法。

一个简单的接口定义文件示例：

```js
import { IAPI } from 'koact';

export default {
  query: {
    name: String,
  },
  res: String,
  async handler({ query }): Promise<string> {
    return `Hello ${query.name}`;
  },
  pre: [async (ctx, next) => {
    ctx.set('file', __filename);
    await next();
  }],
} as IAPI<{}, {
  name: string;
}, {}, string>;
```

### 自动的接口文档 & 局部接口配置

可以在相应的文件夹下定义`META.ts|js`文件来定义自动化生成的文档入口和局部（即META文件所在目录及所有子目录下）接口的统一配置：

`META`文件中`export default`一个类型为`IMeta`的模块即可被解析，`IMeta`的定义如下：

```js
export interface IMetaBase extends IObject {
  title?: string; // 文档的title
  description?: string; // 文档的描述
  notSubDoc?: boolean; // 是否生成子文档，默认true
}

export interface IMeta extends IMetaBase {
  pre?: Middleware[]; // 局部接口配置的前置中间件
  enhancers?: Enhancer[]; // 局部接口配置的增强器
}
```

一个简单的`Meta`文件示例：

```js
import { IAPIBase, IMeta } from 'koact';

export default {
  title: 'This is the API documents.',
  plugins: [(api: IAPIBase, { method, name, path }) => {
    console.log(name, method, path);
    if (!api.pre) {
      api.pre = [];
    }
    api.pre.push(async (ctx, next) => {
      ctx.set('dir', __dirname);
      await next();
    });
    return api;
  }],
} as IMeta;
```

### 一个完整的路由文件夹的结构

大概长这样

```bash
routes
├── GET#Gateway.ts
├── META.ts
├── POST#Test\ post.ts
├── manyVersions
│   ├── META.ts
│   ├── _private // 该文件夹下的接口会被忽略
│   │   └── GET#Private\ interface.ts
│   └── user
│       └── #id // 会被解析成params中的id参数
│           ├── GET#Get\ a\ user.ts
│           └── GET.v2#Get\ a\ user.ts // 不同版本的接口，但pathname一样
├── multipart
│   └── POST#Test\ multipart.ts // 对multipart的解析
├── nested
│   └── nested
│       ├── GET#Nested\ API.ts
│       ├── META.ts
│       └── notSub
│           ├── GET#not\ sub\ gateway.ts
│           └── META.ts // 不生成子文档，仅仅作为局部接口的统一配置
└── sub
    └── GET#sub\ gateway.ts
```

可以在项目`test/routes`目录下查看具体每个模块文件的详细内容。

### 自动生成的文档

`koact`会自动生成api接口文档，可以通过`http://<your server host and port>/api.doc`来进行访问。

通过上述地址访问到的为`json`格式的文档数据，也可以使用同一的GUI网页来对文档进行访问：`http://koact-doc.bestneverland.com/`，在页面中输入服务地址和文档密钥即可。

### 自动生成web前端项目的API定义代码

配合[koact-doc-to-definition](https://github.com/miserylee/koact-doc-to-definition)工具，可以在web前端项目中自动生成`koact`路由服务的访问代码。
