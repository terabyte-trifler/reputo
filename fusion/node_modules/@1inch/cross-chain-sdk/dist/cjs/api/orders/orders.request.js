"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersByMakerRequest = exports.OrderStatusRequest = exports.ActiveOrdersRequest = void 0;
const pagination_js_1 = require("../pagination.js");
class ActiveOrdersRequest {
    pagination;
    constructor(params = {}) {
        this.pagination = new pagination_js_1.PaginationRequest(params.page, params.limit);
    }
    build() {
        return {
            page: this.pagination.page,
            limit: this.pagination.limit
        };
    }
}
exports.ActiveOrdersRequest = ActiveOrdersRequest;
class OrderStatusRequest {
    orderHash;
    constructor(params) {
        this.orderHash = params.orderHash;
    }
    build() {
        return {
            orderHash: this.orderHash
        };
    }
}
exports.OrderStatusRequest = OrderStatusRequest;
class OrdersByMakerRequest {
    address;
    pagination;
    srcChain;
    dstChain;
    srcToken;
    dstToken;
    withToken;
    timestampFrom;
    timestampTo;
    constructor(params) {
        this.address = params.address;
        this.pagination = new pagination_js_1.PaginationRequest(params.page, params.limit);
        this.srcChain = params.srcChain;
        this.dstChain = params.dstChain;
        this.srcToken = params.srcToken;
        this.dstToken = params.dstToken;
        this.withToken = params.withToken;
        this.timestampFrom = params.timestampFrom;
        this.timestampTo = params.timestampTo;
    }
    buildQueryParams() {
        return {
            limit: this.pagination.limit,
            page: this.pagination.page,
            srcChain: this.srcChain,
            dstChain: this.dstChain,
            srcToken: this.srcToken,
            dstToken: this.dstToken,
            withToken: this.withToken,
            timestampFrom: this.timestampFrom,
            timestampTo: this.timestampTo
        };
    }
}
exports.OrdersByMakerRequest = OrdersByMakerRequest;
//# sourceMappingURL=orders.request.js.map