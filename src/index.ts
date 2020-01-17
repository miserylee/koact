import * as fs from 'fs';
import { Context, Middleware } from 'koa';
import * as bodyParser from 'koa-body';
import * as compose from 'koa-compose';
import { IMiddleware } from 'koa-router';
import * as Router from 'koa-router';
import * as path from 'path';
import Schema from 'schema.io';

type Methods = 'get' | 'post' | 'put' | 'delete' | 'del' | 'head' | 'options' | 'patch' | 'all';

export interface IObject {
  [key: string]: any;
}

export type APIHandler<P, Q, B, R> = (data: { params: P, query: Q, body: B, ctx: Context, next: () => Promise<void> }) => Promise<R>;

export interface IAPIBase<P = any, Q = any, B = any, R = any> extends IObject {
  params?: IObject;
  query?: IObject;
  body?: IObject;
  res?: any;
  handler?: APIHandler<P, Q, B, R>;
  pre?: Middleware[];
  useCustomBodyParser?: boolean;
}

export interface IAPI<P = any, Q = any, B = any, R = any> extends IAPIBase<P, Q, B, R> {
  plugins?: Plugin[];
  enhancers?: Enhancer[];
}

export interface IMetaBase extends IObject {
  title?: string;
  notSubDoc?: boolean;
}

export interface IMeta extends IMetaBase {
  pre?: Middleware[];
  plugins?: Plugin[];
  enhancers?: Enhancer[];
}

export type Plugin = (api: IAPIBase, info: { method: string, name: string, path: string }) => IAPIBase;

export type Enhancer = Plugin;

export interface IOptions {
  resolves?: string[];
  docSecret?: string;
}

const validate = (schema: Schema, input: any, errorName: string) => {
  try {
    return schema.validate(input);
  } catch (e) {
    e.name = errorName;
    throw e;
  }
};

const routesOfPath = (routesPath: string, parentPre: Middleware[] = [], enhancers: Enhancer[] = [], parent: string = '', options: IOptions = {}) => {
  const router = new Router();
  const links = fs.readdirSync(routesPath);
  let memo: Array<{
    method: Methods;
    path: string;
    version: {
      [v: string]: {
        name: string;
        params: any;
        query: any;
        body: any;
        res: any;
      };
    };
  }> = [];
  const meta = (() => {
    const metaPath = path.resolve(routesPath, 'META');
    try {
      const metaInfo = require(metaPath).default || {} as IMeta;
      const metaEnhancers = [...(metaInfo.enhancers || []), ...(metaInfo.plugins || [])];
      const metaPre = metaInfo.pre || [];
      Reflect.deleteProperty(metaInfo, 'plugins');
      Reflect.deleteProperty(metaInfo, 'enhancers');
      Reflect.deleteProperty(metaInfo, 'pre');
      enhancers = [...enhancers, ...metaEnhancers];
      parentPre = [...parentPre, ...metaPre];
      return metaInfo as IMetaBase;
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return;
      }
      console.error(`Failed requiring ${metaPath}`);
      console.error(error);
      return;
    }
  })();
  const subDocs: Array<{
    meta: IMetaBase;
    path: string;
  }> = [];
  const pathname = parent || '/';
  const routeModules: {
    [method: string]: {
      [version: string]: {
        summary: {
          name: string;
          params: any;
          query: any;
          body: any;
          res: any;
          [others: string]: any;
        },
        middleware: IMiddleware,
      };
    };
  } = {};

  links.forEach(link => {
    if (/^_/.test(link)) {
      return;
    }
    const fullLink = path.resolve(routesPath, link);
    if (fs.statSync(fullLink).isDirectory()) {
      const p = `/${link.replace(/#/g, ':')}`;
      const subRouter = routesOfPath(fullLink, parentPre, enhancers, `${parent}${p}`, options);
      if (subRouter.doc) {
        subDocs.push(subRouter.doc);
      }
      subDocs.push(...subRouter.subDocs);
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
      const [methodWithVersion, apiName] = name.split('#');
      const [method, version = 'default'] = methodWithVersion.split('.');
      const umethod = method.toUpperCase();
      if ((router as any).methods.includes(umethod)) {
        const lmethod = method.toLowerCase() as Methods;
        const api = require(fullLink).default || {} as IAPI;
        const apiEnhancers = [...(api.enhancers || []), ...(api.plugins || [])];
        Reflect.deleteProperty(api, 'plugins');
        Reflect.deleteProperty(api, 'enhancers');
        const { params, query, body, res, handler = async () => undefined, pre = [], useCustomBodyParser = false, ...others } = [...apiEnhancers, ...enhancers].reduce((a, enhancer) => {
          return enhancer(a, {
            name: apiName,
            method: umethod,
            path: pathname,
          });
        }, api as IAPIBase) as IAPIBase;

        const paramsSchema = new Schema(params);
        const querySchema = new Schema(query);
        const bodySchema = new Schema(body);
        const resSchema = new Schema(res);

        const preMiddleware: Middleware[] = [...parentPre, ...pre];
        if (!useCustomBodyParser && ['post', 'put'].includes(lmethod)) {
          preMiddleware.push(bodyParser({ multipart: true }));
        }

        if (!(lmethod in routeModules)) {
          routeModules[lmethod] = {};
        }
        routeModules[lmethod][version] = {
          summary: {
            name: apiName,
            params: params && paramsSchema.summary(),
            query: query && querySchema.summary(),
            body: body && bodySchema.summary(),
            res: res && resSchema.summary(),
            ...others,
          },
          middleware: compose([...preMiddleware, async (ctx, next) => {
            if (/^multipart/.test(ctx.get('content-type'))) {
              ctx.request.body = {
                ...ctx.request.body.fields,
                ...ctx.request.body.files,
              };
            }
            ctx.body = validate(resSchema, await handler({
              params: validate(paramsSchema, ctx.params, 'ParamsValidationError') || {},
              query: validate(querySchema, ctx.query, 'QueryValidationError') || {},
              body: validate(bodySchema, ctx.request.body, 'BodyValidationError') || {},
              ctx,
              next,
            }), 'ResValidationError');
          }]),
        };
      } else {
        console.error(`Method [${method}] is not allowed. ${link}`);
      }
    }
  });

  Object.keys(routeModules).forEach(method => {
    const lmethod = method as Methods;
    const modules = routeModules[method];
    memo.push({
      method: lmethod,
      path: pathname,
      version: Object.keys(modules).reduce((mememo, version) => {
        mememo[version] = modules[version].summary;
        return mememo;
      }, {} as any),
    });
    router[lmethod]('/', async (ctx, next) => {
      const version = ctx.get('version') || ctx.query.version || 'default';
      const module = modules[version];
      if (module) {
        const middleware = module.middleware;
        await middleware(ctx, next);
      } else {
        ctx.throw(501);
      }
    });
  });

  let doc: {
    meta: IMetaBase;
    path: string;
  } | undefined;
  if (meta && meta.notSubDoc !== true) {
    const memoCopy = [...memo];
    if (options.docSecret) {
      router.use('/api.doc', async (ctx, next) => {
        const docSecret = ctx.query.docSecret;
        if (!docSecret || docSecret !== options.docSecret) {
          ctx.throw(403, 'Invalid secret for viewing api document.');
        }
        await next();
      });
    }
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
    subDocs,
  };
};

const koact = (routesPath: string, enhancers?: Enhancer[], options: IOptions = {}) => {
  const { router } = routesOfPath(routesPath, [], enhancers, undefined, {
    resolves: ['.js', '.ts', '.node'],
    ...options,
  });
  return router.routes();
};

export default koact;
