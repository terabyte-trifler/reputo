import { HttpProviderConnector } from '@1inch/fusion-sdk';
import { ActiveOrdersRequest, OrdersByMakerRequest, OrderStatusRequest } from './orders.request.js';
import { ActiveOrdersResponse, CancellableOrdersResponse, OrdersApiConfig, OrdersByMakerResponse, OrderStatusResponse, PublishedSecretsResponse, ReadyToAcceptSecretFills, ReadyToExecutePublicActions } from './types.js';
import { PaginationRequest } from '../../api/pagination.js';
export declare class OrdersApi {
    private readonly config;
    private readonly httpClient;
    private static Version;
    constructor(config: OrdersApiConfig, httpClient: HttpProviderConnector);
    getActiveOrders(params?: ActiveOrdersRequest): Promise<ActiveOrdersResponse>;
    getOrderStatus(params: OrderStatusRequest): Promise<OrderStatusResponse>;
    getOrdersByMaker(params: OrdersByMakerRequest): Promise<OrdersByMakerResponse>;
    getReadyToAcceptSecretFills(orderHash: string): Promise<ReadyToAcceptSecretFills>;
    getReadyToExecutePublicActions(): Promise<ReadyToExecutePublicActions>;
    getPublishedSecrets(orderHash: string): Promise<PublishedSecretsResponse>;
    getCancellableOrders(pagination?: PaginationRequest): Promise<CancellableOrdersResponse>;
}
