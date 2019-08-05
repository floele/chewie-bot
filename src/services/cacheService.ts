import { injectable } from 'inversify';
import * as NodeCache from 'node-cache';
import { Logger } from '@overnightjs/logger';

export enum CacheType {
    OAuth,
}

@injectable()
export class CacheService {
    private caches: Map<CacheType, any>;

    constructor() {
        this.caches = new Map();
        this.caches.set(CacheType.OAuth, new NodeCache({ stdTTL: 60, deleteOnExpire: true, checkperiod: 600 }));
    }

    public set(cacheType: CacheType, key: any, value: any) {
        const cache = this.caches.get(cacheType);
        if (cache) {
            cache.set(key, value, (err: any, success: any) => {
                if (!err && success) {
                    Logger.Info(`[SET]:: Cache[${cacheType}] - ${key} / ${value}`);
                } else if (err) {
                    Logger.Err(`[SET]:: Cache[${cacheType}] - ${key} / ${value} --- ${err}`);
                    throw err;
                }
            });
        }
    }

    public get(cacheType: CacheType, key: any): any {
        const cache = this.caches.get(cacheType);
        if (cache) {
            const value = cache.get(key);
            Logger.Info(`[GET]:: Cache[${cacheType}] - ${key} / ${value}`);
            return value;
        }
    }
}

export default CacheService;
