import * as Config from "../config.json";
import Constants from "../constants";
import { inject, injectable } from "inversify";
import { UserService } from "./userService";
import { IUserPrincipal, ProviderType} from "../models/userPrincipal";
import { HttpClient, HttpMethods } from "../helpers/httpClient";
import { AxiosResponse } from "axios";
import { ITwitchUserProfile, ITwitchSubscription, ITwitchUser } from "../models";
import TwitchAuthService from "./twitchAuthService";

/**
 * Provides acces to Twitch API endpoint for checking a user's
 * permission and getting the user profile.
 */
@injectable()
export class TwitchWebService {
    private readonly twitchExecutor: HttpClient = new HttpClient(Constants.TwitchAPIEndpoint);
    private readonly getUserProfileUrl: string = "users";
    private readonly getModeratorsUrl: string = "moderation/moderators";
    private readonly getSubscribersUrl: string = "subscriptions";

    constructor(@inject(UserService) private userService: UserService,
                @inject(TwitchAuthService) private authService: TwitchAuthService) {
        this.twitchExecutor.setLogging(true);
    }

    public async fetchUserProfile(user: string): Promise<ITwitchUserProfile | undefined> {
        const header: any = await this.buildHeaderFromClientId();
        const execute = this.twitchExecutor.build(header);

        return await execute(HttpMethods.GET, this.getUserProfileUrl + `?login=${user}`)
            .then((resp: AxiosResponse) => {
                if (resp === undefined) {
                    return undefined;
                }

                if (resp.data === undefined) {
                    throw new Error("malformed data");
                }

                const json: any = resp.data.data[0];

                const profile: ITwitchUserProfile  = {
                    id: json.id,
                    username: json.login,
                    displayName: json.display_name,
                    profileImageUrl: json.profile_image_url
                };

                return profile;
            });
    }

    /**
     *  Fetches the list of moderators if users is empty.
     *  If users are specified, then a moderator subset will be returned from the list.
     *  Wraps https://dev.twitch.tv/docs/api/reference#get-moderators
     *
     * @param users (optional) - name of users that wants to validate for moderators
     */
    public async fetchModerators(users?: string[]): Promise<ITwitchUser[]> {
        const broadcasterCtx: IUserPrincipal | undefined = await this.getBroadcasterUserPrincipal();
        if (broadcasterCtx === undefined) {
            return [] as ITwitchUser[];
        }

        let getModeratorsUrl = `${this.getModeratorsUrl}?broadcaster_id=${broadcasterCtx.userId}`;

        if (users && users.length > 0) {
            const userIds: number[] = await Promise.all(users.map(async (user: string) => {
                const userProfile: ITwitchUserProfile | undefined = await this.fetchUserProfile(user);
                return userProfile?.id ?? 0;
            }));

            userIds.forEach((userId: number) => {
                getModeratorsUrl += `&user_id=${userId}`;
            });
        }

        const header: any = await this.buildHeaderFromUserPrincipal(broadcasterCtx);
        const execute = this.twitchExecutor.build(header);

        return await execute(HttpMethods.GET, getModeratorsUrl)
            .then((resp: AxiosResponse) => {
                if (resp === undefined) {
                    return [] as ITwitchUser[];
                }

                if (resp.data === undefined) {
                    throw new Error("malformed data");
                }

                const json: any = resp.data;
                if (!json.data) {
                    // List empty: return empty array
                    return [] as ITwitchUser[];
                }
                const moderators: ITwitchUser[] = json.data;
                return moderators;
            });
    }

    /**
     *  Fetches the list of subscribers if users is empty.
     *  If users are specified, a subscriber subset will be returned from the list.
     *  reference - https://dev.twitch.tv/docs/api/reference#get-broadcaster-subscriptions
     *
     * @param users (optional) - name of users that wants to validate for moderators
     */
    public async fetchSubscribers(users?: string[]): Promise<ITwitchSubscription[]> {
        const broadcasterCtx: IUserPrincipal | undefined = await this.getBroadcasterUserPrincipal();
        if (broadcasterCtx === undefined) {
            return [] as ITwitchSubscription[];
        }

        let getSubsUrl = `${this.getSubscribersUrl}?broadcaster_id=${broadcasterCtx.userId}`;

        if (users && users.length > 0) {
            const userIds: number[] = await Promise.all(users.map(async (user: string) => {
                const userProfile: ITwitchUserProfile | undefined = await this.fetchUserProfile(user);
                return userProfile?.id ?? 0;
            }));

            userIds.forEach((userId: number) => {
                getSubsUrl += `&user_id=${userId}`;
            });
        }

        const header: any = await this.buildHeaderFromUserPrincipal(broadcasterCtx);
        const execute = this.twitchExecutor.build(header);

        return await execute(HttpMethods.GET, getSubsUrl)
            .then((resp: AxiosResponse) => {
                if (resp.data === undefined) {
                    throw new Error("malformed data");
                }

                const subscriptions: ITwitchSubscription[] = resp.data.data;
                return subscriptions;
            });

    }

    private async buildHeaderFromUserPrincipal(ctx: IUserPrincipal): Promise<any> {
        if (ctx.accessToken === undefined || ctx.accessToken === "") {
            throw new Error(`no access token for ${ctx}`);
        }

        const auth = await this.authService.getUserAccessToken(ctx);

        const user = await this.userService.getUser(ctx.username);
        if (user) {
            user.accessToken = auth.accessToken.token;
            user.refreshToken = auth.refreshToken;
            this.userService.updateUser(user);
        }

        return {
            "Authorization": `Bearer ${auth.accessToken.token}`,
            "Client-ID": auth.clientId
        };
    }

    private async buildHeaderFromClientId(): Promise<any> {
        if (Config.twitch.clientId === undefined || Config.twitch.clientId === "") {
            throw new Error(`No Twitch client id configured`);
        }

        const auth = await this.authService.getClientAccessToken();
        return {
            "Authorization": `Bearer ${auth.accessToken.token}`,
            "Client-ID": auth.clientId
        };
    }

    private async getBroadcasterUserPrincipal(): Promise<IUserPrincipal | undefined> {
        return this.userService.getUserPrincipal(Config.twitch.broadcasterName, ProviderType.Twitch);
    }
}

export default TwitchWebService;