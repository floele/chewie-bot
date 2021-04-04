import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "inversify";
import { EventLogType, IEventLog, IUser } from "../models";
import { APIHelper } from "../helpers";
import { Logger, LogType } from "../logger";
import { EventLogsRepository, UserLevelsRepository, UsersRepository } from "../database";
import { UserService } from "../services/userService";

@injectable()
class UserlistController {
    constructor(@inject(UsersRepository) private userRepository: UsersRepository,
                @inject(UserService) private userService: UserService,
                @inject(UserLevelsRepository) private userLevels: UserLevelsRepository,
                @inject(EventLogsRepository) private eventLogs: EventLogsRepository) {
        Logger.info(
            LogType.ServerInfo,
            `UserlistController constructor. UserlistRepository exists: ${this.userRepository !== undefined}`
        );
    }

    /**
     * Get the full user list.
     * @param req Express HTTP Request
     * @param res Express HTTP Response
     */
    public async getUserlist(req: Request, res: Response): Promise<void> {
        const users = await this.userRepository.getList();
        const userDataMinimal = users.map((x) => this.userRepository.mapUserToDetailsUserData(x));
        res.status(StatusCodes.OK);
        res.send(userDataMinimal);
    }

    /**
     * Get the list of user levels.
     * @param req Express HTTP Request
     * @param res Express HTTP Response
     */
    public async getUserLevels(req: Request, res: Response): Promise<void> {
        const userLevels = await this.userLevels.getList();
        res.status(StatusCodes.OK);
        res.send(userLevels);
    }

    /**
     * Updates the details of a user.
     * @param req Express HTTP Request
     * @param res Express HTTP Response
     */
    public async updateUser(req: Request, res: Response): Promise<void> {
        const newUser = req.body as IUser;
        if (!newUser) {
            res.status(StatusCodes.BAD_REQUEST);
            res.send(APIHelper.error(StatusCodes.BAD_REQUEST, "Request body does not include a user object."));
            return;
        }

        try {
            await this.userRepository.updateDetails(newUser);
            res.status(StatusCodes.OK);
            res.send(newUser);
        } catch (err) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR);
            res.send(
                APIHelper.error(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    "There was an error when attempting to add the user."
                )
            );
        }
    }

    /**
     * Add a user to the user list.
     * @param req Express HTTP Request
     * @param res Express HTTP Response
     */
    public async addUser(req: Request, res: Response): Promise<void> {
        const newUser = req.body as IUser;
        if (!newUser) {
            res.status(StatusCodes.BAD_REQUEST);
            res.send(APIHelper.error(StatusCodes.BAD_REQUEST, "Request body does not include a user object."));
            return;
        }

        try {
            await this.userRepository.add(newUser);
            res.status(StatusCodes.OK);
            res.send(newUser);
        } catch (err) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR);
            res.send(
                APIHelper.error(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    "There was an error when attempting to add the user."
                )
            );
        }
    }

    /**
     * Adds a number of weeks of VIP gold to a user.
     * @param req Express HTTP Request
     * @param res Express HTTP Response
     */
    public async addVipGold(req: Request, res: Response): Promise<void> {
        const username = req.params.username;
        if (!username) {
            res.status(StatusCodes.BAD_REQUEST);
            res.send(APIHelper.error(StatusCodes.BAD_REQUEST, "Request body does not include a user object."));
            return;
        }

        try {
            // Get data from database. Makes sure all properties are correctly typed and data is current.
            const userData = await this.userService.getUser(username);
            if (!userData) {
                res.status(StatusCodes.BAD_REQUEST);
                res.send(APIHelper.error(StatusCodes.BAD_REQUEST, "User not found in database."));
                return;
            }

            if (req.body.weeks) {
                const vipGoldWeeks = parseInt(req.body.weeks, 10);
                if (vipGoldWeeks === 0) {
                    // Nothing to do.
                    res.sendStatus(StatusCodes.OK);
                    return;
                }

                await this.userService.addVipGoldWeeks(userData, vipGoldWeeks);

                res.status(StatusCodes.OK);
                res.send(this.userRepository.mapUserToDetailsUserData(userData));
            } else {
                const vipGoldRequests = parseInt(req.body.amount, 10);
                if (vipGoldRequests === 0) {
                    // Nothing to do.
                    res.sendStatus(StatusCodes.OK);
                    return;
                }

                await this.userService.addPermanentVip(userData, vipGoldRequests);

                res.status(StatusCodes.OK);
                res.send(this.userRepository.mapUserToDetailsUserData(userData));
            }
        } catch (err) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR);
            res.send(
                APIHelper.error(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    "There was an error when attempting to update the VIP status."
                )
            );
        }
    }

    /**
     * Remove a user from the userlist by ID.
     * @param req Express HTTP Request
     * @param res Express HTTP Response
     */
    public removeUser(req: Request, res: Response): void {
        const user = req.body as IUser;
        if (user) {
            this.userRepository.delete(user);
        } else if (Number(req.body)) {
            this.userRepository.delete(req.body);
        } else {
            res.status(StatusCodes.BAD_REQUEST);
            res.send(APIHelper.error(StatusCodes.BAD_REQUEST, "Request body does not include a user object."));
            return;
        }

        res.sendStatus(StatusCodes.OK);
    }

    /**
     * Gets a full user profile for a specific user.
     * Includes basic user data and gold logs.
     * @param req Express HTTP Request
     * @param res Express HTTP Response
     */
    public async getUserProfile(req: Request, res: Response): Promise<void> {
        const username = req.params.username;
        if (!username) {
            res.status(StatusCodes.BAD_REQUEST);
            res.send(APIHelper.error(StatusCodes.BAD_REQUEST, "Request body does not include a user object."));
            return;
        }

        const user = await this.userService.getUser(username);
        if (!user) {
            res.status(StatusCodes.BAD_REQUEST);
            res.send(APIHelper.error(StatusCodes.BAD_REQUEST, "User not found in database."));
            return;
        }

        const userData = this.userRepository.mapUserToDetailsUserData(user);
        const goldLogs = (await this.eventLogs.getForUser(username, [EventLogType.GoldAdded, EventLogType.SongRequest])).map(x => this.mapToEvent(x));
        const rank = await this.userRepository.getPointsRank(user);

        const userProfile = {
            user: userData,
            pointsRank: rank,
            goldLogs
        };

        res.status(StatusCodes.OK);
        res.send(userProfile);
    }

    private mapToEvent(x: IEventLog): any {
        const data = JSON.parse(x.data);
        let event = "";
        let info = "";

        switch (x.type) {
            case EventLogType.GoldAdded:
                const dateFormatShort = new Intl.DateTimeFormat("en", { day: "2-digit", year: "numeric", month: "short" });
                event = `${data.monthsAdded} months added`;
                info = `New expiry: ${dateFormatShort.format(new Date(data.newExpiry))}`;
                break;

            case EventLogType.SongRequest:
                event = `Song requested`;
                info = `${data.song.title} (${data.song.url})`;
                break;
        }

        return { time: x.time, event, info };
    }
}

export default UserlistController;

