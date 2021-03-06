import { inject, injectable } from "inversify";
import { DatabaseProvider, DatabaseTables } from "../services/databaseService";
import { IVIPLevel } from "./../models";

@injectable()
export class VIPLevelsRepository {
    constructor(@inject("DatabaseProvider") private databaseProvider: DatabaseProvider) {
        // Empty
    }

    public async get(name: string): Promise<IVIPLevel> {
        const databaseService = await this.databaseProvider();
        const vipLevel = await databaseService.getQueryBuilder(DatabaseTables.VIPLevels).first().where({ name });
        return vipLevel as IVIPLevel;
    }

    public async add(name: string, rank: number): Promise<void> {
        const databaseService = await this.databaseProvider();
        await databaseService.getQueryBuilder(DatabaseTables.VIPLevels).insert({ name });
    }
}

export default VIPLevelsRepository;
