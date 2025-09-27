import { FusionOrder } from '@1inch/fusion-sdk';
import { EscrowExtension } from './escrow-extension.js';
import { EvmExtra, OrderInfoData } from './types.js';
/**
 * Inner order class, not intended for public usage
 */
export declare class InnerOrder extends FusionOrder {
    readonly escrowExtension: EscrowExtension;
    constructor(extension: EscrowExtension, orderInfo: OrderInfoData, extra?: EvmExtra);
}
