import * as notifService from '../services/notificationService.js';

export async function listNotifications(req, res, next) {
  try {
    const result = await notifService.listNotifications(req.query, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const result = await notifService.getUnreadCount(req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const result = await notifService.markRead(req.params.id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const result = await notifService.markAllRead(req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncements(req, res, next) {
  try {
    const result = await notifService.listAnnouncements(req.query.limit, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req, res, next) {
  try {
    const announcement = await notifService.createAnnouncement(req.body, req.user);
    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
}
