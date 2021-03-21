import { inject, injectable } from "inversify";
import { RequestSource } from "../models";
import BotSettingsService, { BotSettings } from "./botSettingsService";
import SongService from "./songService";
import { IDonationMessage } from "./streamlabsService";
import UserService from "./userService";

@injectable()
export default class DonationService {
    constructor(@inject(SongService) private songService: SongService,
                @inject(UserService) private userService: UserService,
                @inject(BotSettingsService) private settings: BotSettingsService) {
    }

    public processDonation(donation: IDonationMessage) {
        this.addUserPoints(donation);
        this.addSongsToQueue(donation);
    }

    private async addUserPoints(donation: IDonationMessage) {
        const user = await this.userService.getUser(donation.from);

        // Only update user if we have a valid entry in our database. This
        // requires using the actual Twitch user name for the donation.
        if (user) {
            const pointsPerDollar = parseInt(await this.settings.getValue(BotSettings.DonationPointsPerDollar, "100"), 10);
            await this.userService.changeUserPoints(user, pointsPerDollar * donation.amount);
        }
    }

    private async addSongsToQueue(donation: IDonationMessage) {
        const urlRegex: RegExp = /(https?:\/\/[^\s]+)/g;
        const amountPerSong = parseFloat(await this.settings.getValue(BotSettings.DonationPointsPerDollar, "15"));
        let amountLeft = donation.amount;

        const matches = urlRegex.exec(donation.message);
        if (matches) {
            for (const match of matches) {
                // Consider the possibility of multiple requests for a single donation
                if (amountLeft >= amountPerSong) {
                    try {
                        await this.songService.addSong(match, RequestSource.Donation, donation.from);
                        amountLeft -= amountPerSong;
                    } catch {
                        // Ignore any invalid songs
                        // TODO: Accept URLs from unknown services.
                    }
                }
            }
        }
    }
}