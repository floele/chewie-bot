import axios, { AxiosRequestConfig } from "axios";
import { inject, injectable } from "inversify";
import { Logger, LogType } from "../logger";
import * as Config from "../config.json";
import Constants from "../constants";
import * as moment from "moment";
import { StatusCodes } from "http-status-codes";
import { Request } from "express";
import * as crypto from "crypto";

interface ISubscriptionData {
    id?: string;
    status?: string;
    type: string;
    version: string;
    condition: ISubscriptionCondition;
    transport: ISubscriptionTransport;
    createdAt?: Date;
}

interface ISubscriptionResponse extends ISubscriptionData {
    status: string;
    id: string;
    created_at: string;
}

interface ISubscriptionCondition {
    broadcaster_user_id: string;
}

interface ISubscriptionTransport {
    method: string;
    callback: string;
    secret: string;
}

interface IAccessToken {
    token: string;
    expiry: number;
}

interface IEventSubNotification {
    subscription: ISubscriptionData;
    event: any;
}

enum EventTypes {
    StreamOnline = "stream.online",
    StreamOffline = "stream.offline",
    ChannelPointsRedeemed = "channel.channel_points_custom_reward_redemption.add",
}

@injectable()
export default class TwitchEventService {
    private accessToken: IAccessToken;
    private verificationSecret: string = "asdfgh";
    private channelRewards: any[];

    constructor() {
        this.accessToken = {
            token: "",
            expiry: 0,
        };
        this.channelRewards = [];
    }

    public async verifySignature(req: Request): Promise<boolean> {
        const message: string =
            (req.headers["Twitch-Eventsub-Message-Id"] as string) +
            (req.headers["Twitch-Eventsub-Message-Timestamp"] as string) +
            req.body;
        const sha = crypto.createHmac("sha256", this.verificationSecret).update(message).digest("base64");
        const signature = `sha256=${sha}`;
        return signature === req.headers["Twitch-Eventsub-Message-Signature"];
    }

    public async handleNotification(notification: IEventSubNotification): Promise<void> {
        if (notification.subscription.type) {
            switch (notification.subscription.type) {
                case EventTypes.ChannelPointsRedeemed: {
                    this.channelPointsRedeemedEvent(notification.event);
                    break;
                }
                case EventTypes.StreamOnline: {
                    this.channelOnlineEvent(notification.event);
                    break;
                }
                case EventTypes.StreamOffline: {
                    this.channelOfflineEvent(notification.event);
                    break;
                }
                default: {
                    Logger.warn(
                        LogType.Twitch,
                        `Twitch EventSub Notification received for event type ${notification.subscription.type}, but that event type is not handled.`,
                        notification
                    );
                    break;
                }
            }
        }
    }

    private channelPointsRedeemedEvent(notificationEvent: any): void {
        Logger.info(LogType.Twitch, notificationEvent);
    }

    private channelOnlineEvent(notificationEvent: any): void {
        Logger.info(LogType.Twitch, notificationEvent);
    }

    private channelOfflineEvent(notificationEvent: any): void {
        Logger.info(LogType.Twitch, notificationEvent);
    }

    public async subscribeEvent(event: EventTypes, userId: string): Promise<void> {
        const data = this.getSubscriptionData(event, userId);
        const result = await this.createSubscription(data);
        Logger.info(LogType.Twitch, `Created subscription for event type: ${event} for user id: ${userId}`, result);
    }

    public async subscribeStreamOnline(userId: string): Promise<void> {
        const data = this.getSubscriptionData(EventTypes.StreamOnline, userId);
        const result = await this.createSubscription(data);
    }

    public async subscribeStreamOffline(userId: string): Promise<void> {
        const data = this.getSubscriptionData(EventTypes.StreamOffline, userId);
        const result = await this.createSubscription(data);
    }

    public async subscribePointsRedeemed(userId: string): Promise<void> {
        const data = this.getSubscriptionData(EventTypes.ChannelPointsRedeemed, userId);
        const result = await this.createSubscription(data);
    }

    private getSubscriptionData(type: EventTypes, userId: any): ISubscriptionData {
        return {
            type,
            version: "1",
            condition: {
                broadcaster_user_id: userId,
            },
            transport: {
                method: "webhook",
                callback: "https://localhost/api/twitch/eventsub/callback",
                secret: this.verificationSecret,
            },
        };
    }

    public async getSubscriptions(): Promise<void> {
        const options = await this.getOptions();

        const result = await axios.get(Constants.TwitchEventSubEndpoint, options);
        Logger.info(LogType.Twitch, result.data);
    }

    private async deleteSubscription(id: string): Promise<void> {
        const options = await this.getOptions();
        const result = await axios.delete(`${Constants.TwitchEventSubEndpoint}?id=${id}`, options);
    }

    private async createSubscription(data: ISubscriptionData): Promise<ISubscriptionResponse | undefined> {
        const options = await this.getOptions("application/json");

        data.transport.secret = this.verificationSecret;
        const result = await axios.post(Constants.TwitchEventSubEndpoint, data, options);
        if (result.status === StatusCodes.ACCEPTED) {
            return result.data;
        } else {
            return undefined;
        }
    }

    private async refreshToken(): Promise<void> {
        if (this.accessToken.expiry < moment.now()) {
            await this.getAccessToken();
        }
    }

    private async getAccessToken(): Promise<void> {
        const result = await axios.post(
            `${Constants.TwitchTokenUrl}?client_id=${Config.twitch.clientId}&client_secret=${Config.twitch.clientSecret}&grant_type=client_credentials`
        );

        this.accessToken = {
            token: result.data.access_token,
            expiry: moment.now() + result.data.expires_in,
        };
    }

    private async getOptions(contentType?: string): Promise<AxiosRequestConfig> {
        await this.refreshToken();
        const options: AxiosRequestConfig = {
            headers: {
                "Client-Id": Config.twitch.clientId,
                Authorization: `Bearer ${this.accessToken.token}`,
            },
        };

        if (contentType) {
            options.headers["Content-Type"] = contentType;
        }

        return options;
    }
}