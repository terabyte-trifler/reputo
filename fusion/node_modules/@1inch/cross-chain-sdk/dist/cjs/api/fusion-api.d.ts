import { FusionApiConfig } from './types.js';
import { QuoterRequest, QuoterCustomPresetRequest, Quote } from './quoter/index.js';
import { RelayerRequestEvm, RelayerRequestSvm } from './relayer/index.js';
import { ActiveOrdersRequest, ActiveOrdersResponse, OrdersByMakerRequest, OrderStatusRequest, OrderStatusResponse, OrdersByMakerResponse, ReadyToAcceptSecretFills, PublishedSecretsResponse, ReadyToExecutePublicActions, CancellableOrdersResponse } from './orders/index.js';
import { PaginationRequest } from './pagination.js';
export declare class FusionApi {
    private readonly quoterApi;
    private readonly relayerApi;
    private readonly ordersApi;
    constructor(config: FusionApiConfig);
    getQuote(params: QuoterRequest): Promise<Quote>;
    getQuoteWithCustomPreset(params: QuoterRequest, body: QuoterCustomPresetRequest): Promise<Quote>;
    getActiveOrders(params?: ActiveOrdersRequest): Promise<ActiveOrdersResponse>;
    getOrderStatus(params: OrderStatusRequest): Promise<OrderStatusResponse>;
    getOrdersByMaker(params: OrdersByMakerRequest): Promise<OrdersByMakerResponse>;
    getReadyToAcceptSecretFills(orderHash: string): Promise<ReadyToAcceptSecretFills>;
    getReadyToExecutePublicActions(): Promise<ReadyToExecutePublicActions>;
    getPublishedSecrets(orderHash: string): Promise<PublishedSecretsResponse>;
    getCancellableOrders(pagination?: PaginationRequest): Promise<CancellableOrdersResponse>;
    submitOrder(params: RelayerRequestEvm | RelayerRequestSvm): Promise<void>;
    submitOrderBatch(params: RelayerRequestEvm[]): Promise<void>;
    submitSecret(orderHash: string, secret: string): Promise<void>;
}
