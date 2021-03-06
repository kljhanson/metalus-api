const request = require('supertest');
const http = require('http');
const express = require('express');
const kraken = require('kraken-js');
const BaseModel = require('../../lib/base.model');
const expect = require('chai').expect;
const applicationData = require('../data/applications');
const MongoDb = require('../../lib/mongo');
const util = require('util');

describe('Applications API Mongo Tests', () => {
  let app;
  let server;
  let mock;
  const body = applicationData.find(application => application.id === 'c03f6590-5a29-11e9-aa07-a58054497ebb');

  before((done) => {
    app = express();
    server = http.createServer(app);
    app.on('start', () => {
      done();
    });
    app.use(kraken({
      basedir: process.cwd(),
      onconfig: (config, next) => {
        config.set('storageType', 'mongodb');
        config.set('databaseName', 'testDataApplications');
        BaseModel.initialStorageParameters(config);
        MongoDb.init(config)
          .then(() => {
            next(null, config);
          })
          .catch(next);
      }
    }));
    mock = server.listen(1305);
  });

  after(async () => {
    app.removeAllListeners('start');
    await MongoDb.getDatabase().dropDatabase();
    await MongoDb.disconnect();
    await util.promisify(mock.close.bind(mock))();
  });

  it('Should fail insert on missing body', async () => {
    const response = await request(mock)
      .post('/api/v1/applications/')
      .expect('Content-Type', /json/)
      .expect(400);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('message').eq('POST request missing body');
    await request(mock).get('/api/v1/applications').expect(204);
  });

  it('Should fail to insert a single application', async () => {
    const badApp = JSON.parse(JSON.stringify(body));
    delete badApp.name;
    delete badApp.executions;
    const response = await request(mock)
      .post('/api/v1/applications/')
      .send(badApp)
      .expect('Content-Type', /json/)
      .expect(422);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('errors').lengthOf(2);
    expect(resp).to.have.property('body');
    const errors = resp.errors;
    expect(errors.find(err => err.params.missingProperty === 'executions')).to.exist
    expect(errors.find(err => err.params.missingProperty === 'name')).to.exist
    await request(mock).get('/api/v1/applications').expect(204);
  });

  it('Should fail to insert a single application based on execution data', async () => {
    const badApp = JSON.parse(JSON.stringify(body));
    delete badApp.executions[0].id;
    delete badApp.executions[1].pipelineIds;
    delete badApp.executions[1].pipelines;
    const response = await request(mock)
      .post('/api/v1/applications/')
      .send(badApp)
      .expect('Content-Type', /json/)
      .expect(422);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('errors').lengthOf(4);
    expect(resp).to.have.property('body');
    const errors = resp.errors;
    expect(errors.find(err => err.dataPath === '.executions[0]' && err.message === 'should have required property \'id\'')).to.exist
    expect(errors.find(err => err.dataPath === '.executions[1]' && err.message === 'should have required property \'pipelineIds\'')).to.exist
    expect(errors.find(err => err.dataPath === '.executions[1]' && err.message === 'should have required property \'pipelines\'')).to.exist
    expect(errors.find(err => err.dataPath === '.executions[1]' && err.message === 'should match some schema in anyOf')).to.exist
    await request(mock).get('/api/v1/applications').expect(204);
  });

  it('Should insert a single application', async () => {
    const response = await request(mock)
      .post('/api/v1/applications/')
      .send(body)
      .expect('Content-Type', /json/)
      .expect(201);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('application');
    verifyApplication(resp.application, body);
  });

  it('Should get the inserted application', async () => {
    const response = await request(mock)
      .get(`/api/v1/applications/${body.id}`)
      .expect('Content-Type', /json/)
      .expect(200);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('application');
    verifyApplication(resp.application, body);
  });

  it('Should get all applications', async () => {
    const response = await request(mock)
      .get('/api/v1/applications/')
      .expect('Content-Type', /json/)
      .expect(200);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('applications').lengthOf(1);
    verifyApplication(resp.applications[0], body);
  });

  it('Should update an application', async () => {
    body.name = 'Red on the head fred';
    const response = await request(mock)
      .put(`/api/v1/applications/${body.id}`)
      .send(body)
      .expect('Content-Type', /json/)
      .expect(200);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('application');
    verifyApplication(resp.application, body);
  });

  it('Should delete an application', async () => {
    await request(mock).delete(`/api/v1/applications/${body.id}`).expect(204);
    await request(mock).get('/api/v1/applications').expect(204);
  });

  it('Should upsert a single application', async () => {
    const response = await request(mock)
      .put(`/api/v1/applications/${body.id}`)
      .send(body)
      .expect('Content-Type', /json/)
      .expect(200);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('application');
    verifyApplication(resp.application, body);
  });

  it('Should update a single application using post', async () => {
    body.name = 'Some new name';
    const response = await request(mock)
      .post('/api/v1/applications/')
      .send(body)
      .expect('Content-Type', /json/)
      .expect(201);
    const resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('application');
    verifyApplication(resp.application, body);
  });

  it('Should insert multiple applications', async () => {
    const data = applicationData.filter(application => application.id !== 'c03f6590-5a29-11e9-aa07-a58054497ebb');
    let response = await request(mock)
      .post('/api/v1/applications/')
      .send(data)
      .expect('Content-Type', /json/)
    // .expect(201);
    let resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('applications').lengthOf(4);
    resp.applications.forEach(application => verifyApplication(application, data.find(a => a.id === application.id)));
    response = await request(mock)
      .get('/api/v1/applications/')
      .expect('Content-Type', /json/)
      .expect(200);
    resp = JSON.parse(response.text);
    expect(resp).to.exist;
    expect(resp).to.have.property('applications').lengthOf(5);
  });

  function verifyApplication(application, original) {
    expect(application).to.have.property('id');
    expect(application).to.have.property('name').equal(original.name);
    if (original.stepPackages) {
      expect(application).to.have.property('stepPackages').to.have.members(original.stepPackages);
    }
    conditionalCompare('sparkConf', original, application);
    conditionalCompare('globals', original, application);
    conditionalCompare('applicationProperties', original, application);

    expect(application).to.have.property('creationDate');
    expect(application).to.have.property('modifiedDate');

    expect(application).to.have.property('executions').lengthOf(original.executions.length);
    expect(application.executions).to.have.deep.members(original.executions);
  }

  function conditionalCompare(propertyName, original, application) {
    if (original[propertyName]) {
      expect(application).to.have.property(propertyName).deep.equal(original[propertyName]);
    }
  }
});
