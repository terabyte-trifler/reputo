import { OrderInfo, OrderParams, PreparedOrder, QuoteParams, QuoteCustomPresetParams, CrossChainSDKConfigParams, SolanaOrderCancellationData } from './types.js';
import { SvmCrossChainOrder } from '../cross-chain-order/index.js';
import { FusionApi, Quote, ActiveOrdersRequestParams, ActiveOrdersResponse, OrdersByMakerParams, OrdersByMakerResponse, OrderStatusResponse, ReadyToAcceptSecretFills, PublishedSecretsResponse, ReadyToExecutePublicActions, PaginationOutput } from '../api/index.js';
import { EvmCrossChainOrder } from '../cross-chain-order/evm/index.js';
import { SupportedChain } from '../chains.js';
export declare class SDK {
    private readonly config;
    readonly api: FusionApi;
    constructor(config: CrossChainSDKConfigParams);
    getActiveOrders(params?: ActiveOrdersRequestParams): Promise<ActiveOrdersResponse>;
    getOrderStatus(orderHash: string): Promise<OrderStatusResponse>;
    getOrdersByMaker(params: OrdersByMakerParams): Promise<OrdersByMakerResponse>;
    getReadyToAcceptSecretFills(orderHash: string): Promise<ReadyToAcceptSecretFills>;
    getReadyToExecutePublicActions(): Promise<ReadyToExecutePublicActions>;
    getPublishedSecrets(orderHash: string): Promise<PublishedSecretsResponse>;
    submitSecret(orderHash: string, secret: string): Promise<void>;
    getQuote(params: QuoteParams): Promise<Quote>;
    getQuoteWithCustomPreset(params: QuoteParams, body: QuoteCustomPresetParams): Promise<Quote>;
    createOrder(quote: Quote, params: OrderParams): PreparedOrder;
    submitOrder(srcChainId: SupportedChain, order: EvmCrossChainOrder, quoteId: string, secretHashes: string[]): Promise<OrderInfo>;
    /**
     * Announce solana order to relayer before on chain creation,
     * It's required because on chain data does not contains auction details
     *
     * @param order
     * @param quoteId
     * @param secretHashes
     *
     * @returns orderHash
     */
    announceOrder(order: SvmCrossChainOrder, quoteId: string, secretHashes: string[]): Promise<string>;
    placeOrder(quote: Quote, params: OrderParams): Promise<OrderInfo>;
    /**
     * Only for orders with src chain in EVM
     *
     * @throws Error for non EVM srcChain
     */
    buildCancelOrderCallData(orderHash: string): Promise<string>;
    /**
     * Returns on chain created orders which can be cancelled by resolver for premium
     */
    getCancellableOrders(page?: number, limit?: number): Promise<PaginationOutput<SolanaOrderCancellationData>>;
    private quoteToOrder;
}
