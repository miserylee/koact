import * as fs from 'fs';
import { Context, Middleware } from 'koa';
import * as bodyParser from 'koa-body';
import * as Router from 'koa-router';
import * as path from 'path';
import Schema from 'schema.io';

type Methods = 'get' | 'post' | 'put' | 'delete' | 'del' | 'head' | 'options' | 'patch' | 'all';

export interface IObject {
  [key: string]: any;
}

export type APIHandler = (params: any, query: any, body: any, ctx: Context, next: () => Promise<void>) => Promise<any>;

export interface IAPIBase extends IObject {
  params?: IObject;
  query?: IObject;
  body?: IObject;
  res?: any;
  handler?: APIHandler;
  pre?: Middleware[];
}

export interface IAPI extends IAPIBase {
  plugins?: Plugin[];
}

export interface IMetaBase extends IObject {
  title?: string;
}

export interface IMeta extends IMetaBase {
  pre?: Middleware[];
  plugins?: Plugin[];
}

export type Plugin = (api: IAPIBase, info: { method: string, name: string, path: string }) => IAPIBase;

export interface IOptions {
  resolves?: string[];
}

const routesOfPath = (routesPath: string, plugins: Plugin[] = [], parent: string = '', options: IOptions = {}) => {
  const router = new Router();
  const links = fs.readdirSync(routesPath);
  let memo: Array<{
    name: string;
    method: Methods;
    path: string;
    params: any;
    query: any;
    body: any;
    res: any;
  }> = [];
  const meta = (() => {
    try {
      const { pre = [], ...others } = require(path.resolve(routesPath, 'META')).default || {} as IMeta;
      const metaPlugins = others.plugins || [];
      Reflect.deleteProperty(others, 'plugins');
      router.use(...pre);
      plugins = [...metaPlugins, ...plugins];
      return others as IMetaBase;
    } catch (error) {
      return;
    }
  })();
  const subDocs: Array<{
    meta: IMetaBase;
    path: string;
  }> = [];
  links.forEach(link => {
    if (/^_/.test(link)) {
      return;
    }
    const fullLink = path.resolve(routesPath, link);
    if (fs.statSync(fullLink).isDirectory()) {
      const p = `/${link.replace(/#/g, ':')}`;
      const subRouter = routesOfPath(fullLink, plugins, `${parent}${p}`, options);
      if (subRouter.doc) {
        subDocs.push(subRouter.doc);
      }
      router.use(p, subRouter.router.routes(), subRouter.router.allowedMethods());
      memo.push(...subRouter.memo);
    } else {
      const { name, ext } = path.parse(link);
      if (!options.resolves!.includes(ext)) {
        return;
      }
      if (['META'].includes(name)) {
        return;
      }
      const [method, apiName] = name.split('#');
      const umethod = method.toUpperCase();
      if ((router as any).methods.includes(umethod)) {
        const pathname = parent || '/';
        const lmethod = method.toLowerCase() as Methods;
        const api = require(fullLink).default || {} as IAPI;
        const apiPlugins = api.plugins || [];
        Reflect.deleteProperty(api, 'plugins');
        const { params, query, body, res, handler = async () => undefined, pre = [], ...others } = [...apiPlugins, ...plugins].reduce((a, plugin) => {
          return plugin(a, {
            name: apiName,
            method: umethod,
            path: pathname,
          });
        }, api as IAPIBase);

        const paramsSchema = new Schema(params);
        const querySchema = new Schema(query);
        const bodySchema = new Schema(body);
        const resSchema = new Schema(res);

        memo.push({
          name: apiName,
          method: lmethod,
          path: pathname,
          params: paramsSchema.example(),
          query: querySchema.example(),
          body: bodySchema.example(),
          res: resSchema.example(),
          ...others,
        });
        const preMiddleware: Middleware[] = pre;
        if (lmethod === 'post') {
          preMiddleware.push(bodyParser({ multipart: true }));
        }

        const validate = (schema: Schema, input: any, errorName: string) => {
          try {
            return schema.validate(input);
          } catch (e) {
            e.name = errorName;
            throw e;
          }
        };

        router[lmethod]('/', ...preMiddleware, async (ctx, next) => {
          if (/^multipart/.test(ctx.get('content-type'))) {
            ctx.request.body = {
              ...ctx.request.body.fields,
              ...ctx.request.body.files,
            };
          }
          ctx.body = validate(resSchema, await handler(
            validate(paramsSchema, ctx.params, 'ParamsValidationError') || {},
            validate(querySchema, ctx.query, 'QueryValidationError') || {},
            validate(bodySchema, ctx.request.body, 'BodyValidationError') || {},
            ctx, next,
          ), 'ResValidationError');
        });
      } else {
        console.error(`Method [${method}] is not allowed. ${link}`);
      }
    }
  });
  let doc: {
    meta: IMetaBase;
    path: string;
  } | undefined;
  if (meta) {
    const memoCopy = [...memo];
    router.get('/api.doc', ctx => {
      ctx.body = {
        meta,
        apis: memoCopy,
        subDocs,
      };
    });
    memo = [];
    doc = {
      meta,
      path: `${parent}/api.doc`,
    };
  }
  return {
    memo,
    router,
    doc,
  };
};

const koact = (routesPath: string, plugins?: Plugin[], options: IOptions = {}) => {
  const { router } = routesOfPath(routesPath, plugins, undefined, {
    resolves: ['.js', '.ts', '.node'],
    ...options,
  });
  return router.routes();
};

export default koact;
