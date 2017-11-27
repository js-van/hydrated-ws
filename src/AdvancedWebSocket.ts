import {IAdvancedWebSocketOptions} from "./IAdvancedWebSocketOptions";
import {exponentialTruncatedBackoff} from "./exponentialTruncatedBackoff";
import {WrapperWebSocket} from "./WrapperWebSocket";

export class AdvancedWebSocket extends WrapperWebSocket {


    private timeout: any;
    private connectionTimeout: number = 1000;
    private retryPolicy: (attempt: number, ws: AdvancedWebSocket) => number;
    private _url: string;

    public constructor(url: string, private protocols?: string | string[], options?: IAdvancedWebSocketOptions) {
        super()
        this._url = url;
        if (this.constructor !== AdvancedWebSocket) {
            // Throw a native WebSocket error
            (WebSocket as any)(url);
        }
        this.connectionTimeout = (options && options.connectionTimeout) || this.connectionTimeout;
        this.retryPolicy = (options && options.retryPolicy) || exponentialTruncatedBackoff();
        this.open();
        this._readyState = WebSocket.CONNECTING;
    }

    public get url(): string {
        return this._url;
    }

    public get readyState(): number {
        return this._readyState;
    }

    public get bufferedAmount(): number {
        return this.ws.bufferedAmount;
    }

    public get extensions(): string {
        return this.ws.extensions;
    }

    public get protocol(): string {
        return this.ws.protocol;
    }

    public close(code: number = 1000, reason?: string) {
        if (this.closing) {
            return;
        }
        this.closing = true;
        clearTimeout(this.timeout);
        this.ws.close(code, reason);
    }

    private open(attempt: number = 0) {
        const ws = new WebSocket(this.url, this.protocols || []);
        ws.binaryType = this.binaryType;
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            try {
                ws.close();
            } catch (e) {
            }
            const timeout = this.retryPolicy(attempt + 1, this);
            if (timeout === null) {
                this._readyState = WebSocket.CLOSED;
                this.dispatchEvent(new CloseEvent("close", {code:4000, reason: "Connect timeout"}));
            } else {
                setTimeout(() => this.open(attempt + 1), timeout);
            }
        }, this.connectionTimeout);

        ws.onopen = (event: Event) => {
            attempt = 0;
            clearTimeout(this.timeout);
            this._readyState = WebSocket.OPEN;
            this.dispatchEvent(event);
        };
        ws.onclose = (event) => {
            clearTimeout(this.timeout);
            if (this.closing) {
                this._readyState = WebSocket.CLOSED;
                this.dispatchEvent(event);
            } else {
                const timeout = this.retryPolicy(attempt + 1, this);
                if (timeout === null) {
                    this._readyState = WebSocket.CLOSED;
                    this.dispatchEvent(event);
                } else {
                    this._readyState = WebSocket.CONNECTING;
                    setTimeout(() => this.open(attempt + 1), timeout);
                }

            }
        };
        ws.onmessage = (event) => {
            this.dispatchEvent(event);
        };
        ws.onerror = (event) => {
            this.dispatchEvent(event);
        };
        this.ws = ws;

    }

}