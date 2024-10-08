import * as notifService from '../services/notificationService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export async function listNotifications(req, res, next) {
  try {
    const result = await notifService.listNotifications(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const result = await notifService.getUnreadCount(req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const result = await notifService.markRead(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const result = await notifService.markAllRead(req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncements(req, res, next) {
  try {
    const result = await notifService.listAnnouncements(req.query.limit, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req, res, next) {
  try {
    const announcement = await notifService.createAnnouncement(req.body, req.user);
    sendCreated(res, announcement);
  } catch (err) {
    next(err);
  }
}
