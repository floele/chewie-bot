import { Command } from "../command";
import { IUser } from "../../models";
import { BotContainer } from "../../inversify.config";
import { UsersRepository } from "../../database";

export class TopCommand extends Command {
    private usersRepository: UsersRepository;

    constructor() {
        super();
        this.usersRepository = BotContainer.get(UsersRepository);
    }

    public async executeInternal(channel: string, user: IUser, numberOfUsers: number): Promise<void> {
        const userCount = numberOfUsers ? Math.min(25, numberOfUsers) : 10;

        let result = "Users with top Chews are: ";
        let counter = 1;
        const numFormat = new Intl.NumberFormat();
        for (const user of await this.usersRepository.getTopUsers(userCount)) {
            result += `${counter++}. ${user.username}: ${numFormat.format(user.points)} / `
        }
        
        this.twitchService.sendMessage(channel, result.substr(0, result.length - 2));
    }
}

export default TopCommand;