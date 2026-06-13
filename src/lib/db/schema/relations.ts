import { relations } from "drizzle-orm";

import { attributions } from "./attributions";
import { brands } from "./brands";
import { conversations, messages } from "./conversations";
import { customers } from "./customers";
import { orderLineItems, orders } from "./orders";
import { pendingActions } from "./pendingActions";
import { products, productVariants } from "./products";
import { users } from "./users";

/**
 * Drizzle relations enable typed relational queries (e.g. load a conversation
 * with its messages and customer in one call). They define no DB constraints —
 * foreign keys live on the tables themselves.
 */

export const brandsRelations = relations(brands, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  products: many(products),
  conversations: many(conversations),
  orders: many(orders),
}));

export const usersRelations = relations(users, ({ one }) => ({
  brand: one(brands, { fields: [users.brandId], references: [brands.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  brand: one(brands, { fields: [customers.brandId], references: [brands.id] }),
  conversations: many(conversations),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  brand: one(brands, { fields: [conversations.brandId], references: [brands.id] }),
  customer: one(customers, { fields: [conversations.customerId], references: [customers.id] }),
  assignee: one(users, { fields: [conversations.assigneeUserId], references: [users.id] }),
  messages: many(messages),
  pendingActions: many(pendingActions),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const pendingActionsRelations = relations(pendingActions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [pendingActions.conversationId],
    references: [conversations.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  brand: one(brands, { fields: [orders.brandId], references: [brands.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  attributedConversation: one(conversations, {
    fields: [orders.attributedConversationId],
    references: [conversations.id],
  }),
  lineItems: many(orderLineItems),
}));

export const orderLineItemsRelations = relations(orderLineItems, ({ one }) => ({
  order: one(orders, { fields: [orderLineItems.orderId], references: [orders.id] }),
  variant: one(productVariants, {
    fields: [orderLineItems.variantId],
    references: [productVariants.id],
  }),
}));

export const attributionsRelations = relations(attributions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [attributions.conversationId],
    references: [conversations.id],
  }),
  order: one(orders, { fields: [attributions.orderId], references: [orders.id] }),
}));
