import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import request from 'supertest';
import { pool } from '../src/config/database.js';

describe('University Grading & Registration API Test Suite', () => {
  let adminToken = '';
  let studentToken = '';
  let teacherToken = '';
  let deptHeadToken = '';

  after(async () => {
    await pool.end();
  });

  test('GET /health returns 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
  });

  test('POST /api/v1/auth/login as admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ role: 'admin', identifier: 'admin', password: 'Password123!' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.roleId, 'admin');
    adminToken = res.body.token;
  });

  test('POST /api/v1/auth/login as student with student number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ role: 'student', identifier: 'UGR/24/0001' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.roleId, 'student');
    studentToken = res.body.token;
  });

  test('POST /api/v1/auth/login as teacher with employee number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ role: 'teacher', identifier: 'EMP-CS-01' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.roleId, 'teacher');
    teacherToken = res.body.token;
  });

  test('POST /api/v1/auth/login as dept_head with department code', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ role: 'dept_head', identifier: 'CS' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.roleId, 'dept_head');
    deptHeadToken = res.body.token;
  });

  test('GET /api/v1/auth/me with Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.roleId, 'admin');
  });

  test('GET /api/v1/lookups returns reference metadata', async () => {
    const res = await request(app).get('/api/v1/lookups');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.departments));
    assert.ok(Array.isArray(res.body.programs));
    assert.ok(Array.isArray(res.body.semesters));
    assert.ok(Array.isArray(res.body.gradeScale));
  });

  test('GET /api/v1/courses lists academic courses', async () => {
    const res = await request(app)
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  test('GET /api/v1/student/dashboard returns student workspace', async () => {
    const res = await request(app)
      .get('/api/v1/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.student);
    assert.ok(res.body.currentSemester);
  });

  test('GET /api/v1/teacher/dashboard returns teacher workspace', async () => {
    const res = await request(app)
      .get('/api/v1/teacher/dashboard')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.currentSemester);
    assert.ok(res.body.stats);
  });

  test('GET /api/v1/reports/admin-dashboard returns admin dashboard metrics', async () => {
    const res = await request(app)
      .get('/api/v1/reports/admin-dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.stats);
    assert.ok(res.body.currentSemester);
  });

  test('GET /api/v1/reports/dept-dashboard returns department metrics', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dept-dashboard')
      .set('Authorization', `Bearer ${deptHeadToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.department);
    assert.ok(res.body.stats);
  });

  test('GET /api/v1/grade-submissions returns approval queue', async () => {
    const res = await request(app)
      .get('/api/v1/grade-submissions')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
  });

  test('GET /api/v1/withdrawal-requests returns withdrawal list', async () => {
    const res = await request(app)
      .get('/api/v1/withdrawal-requests')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
  });

  test('GET /api/v1/grading/config returns grading scale and policy', async () => {
    const res = await request(app).get('/api/v1/grading/config');
    assert.equal(res.status, 200);
    assert.ok(res.body.scale);
    assert.ok(res.body.policy);
  });
});
