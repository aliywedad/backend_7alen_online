import { Response } from 'express';

// Restaurant clients — keyed by restaurantId
const restaurantClients = new Map<string, Set<Response>>();

export function addClient(restaurantId: string, res: Response) {
  if (!restaurantClients.has(restaurantId)) restaurantClients.set(restaurantId, new Set());
  restaurantClients.get(restaurantId)!.add(res);
}

export function removeClient(restaurantId: string, res: Response) {
  const set = restaurantClients.get(restaurantId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) restaurantClients.delete(restaurantId);
}

export function emitToRestaurant(restaurantId: string, event: string, data: unknown) {
  const set = restaurantClients.get(restaurantId);
  if (!set || set.size === 0) {
    console.log(`[SSE] ⚠️  No clients for restaurant ${restaurantId} — "${event}" dropped`);
    return;
  }
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  console.log(`[SSE] 📤 Emit "${event}" → restaurant: ${restaurantId} (${set.size} client${set.size > 1 ? 's' : ''})`);
  for (const res of set) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

// Order clients — keyed by orderId (customer + driver tracking)
const orderClients = new Map<string, Set<Response>>();

export function addOrderClient(orderId: string, res: Response) {
  if (!orderClients.has(orderId)) orderClients.set(orderId, new Set());
  orderClients.get(orderId)!.add(res);
}

export function removeOrderClient(orderId: string, res: Response) {
  const set = orderClients.get(orderId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) orderClients.delete(orderId);
}

export function emitToOrder(orderId: string, event: string, data: unknown) {
  const set = orderClients.get(orderId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  console.log(`[SSE] 📤 Emit "${event}" → order: ${orderId} (${set.size} client${set.size > 1 ? 's' : ''})`);
  for (const res of set) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

// Driver clients — all online drivers receiving delivery requests
const driverClients = new Set<Response>();

export function addDriverClient(res: Response) {
  driverClients.add(res);
}

export function removeDriverClient(res: Response) {
  driverClients.delete(res);
}

export function emitToDrivers(event: string, data: unknown) {
  if (driverClients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  console.log(`[SSE] 📤 Emit "${event}" → drivers (${driverClients.size} client${driverClients.size > 1 ? 's' : ''})`);
  for (const res of driverClients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}
