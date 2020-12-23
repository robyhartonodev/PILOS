import View from '../../../../../resources/js/views/settings/servers/View';
import { createLocalVue, mount } from '@vue/test-utils';
import PermissionService from '../../../../../resources/js/services/PermissionService';
import moxios from 'moxios';
import BootstrapVue, {
  IconsPlugin,
  BFormInput,
  BOverlay,
  BButton, BForm, BFormInvalidFeedback, BModal, BFormRating, BFormCheckbox
} from 'bootstrap-vue';
import Vuex from 'vuex';
import sinon from 'sinon';
import Base from '../../../../../resources/js/api/base';
import VueRouter from 'vue-router';
import env from '../../../../../resources/js/env';
import _ from 'lodash';

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.use(IconsPlugin);
localVue.use(Vuex);
localVue.use(VueRouter);

const store = new Vuex.Store({
  modules: {
    session: {
      namespaced: true,
      getters: {
        settings: () => (setting) => setting === 'room_limit' ? -1 : null
      }
    }
  }
});

function overrideStub (url, response) {
  const l = moxios.stubs.count();
  for (let i = 0; i < l; i++) {
    const stub = moxios.stubs.at(i);
    if (stub.url === url) {
      const oldResponse = stub.response;
      const restoreFunc = () => { stub.response = oldResponse; };

      stub.response = response;
      return restoreFunc;
    }
  }
}

let oldUser;

describe('ServerView', function () {
  beforeEach(function () {
    oldUser = PermissionService.currentUser;
    PermissionService.setCurrentUser({ permissions: ['servers.view', 'servers.create', 'servers.update', 'settings.manage'] });
    moxios.install();

    const serverResponse = {
      data: {
        id: 1,
        description: 'Server 01',
        base_url: 'https://localhost/bigbluebutton',
        salt: '123456789',
        strength: 1,
        status: 1,
        participant_count: 14,
        listener_count: 7,
        voice_participant_count: 7,
        video_count: 7,
        meeting_count: 3,
        model_name: 'Server',
        updated_at: '2020-12-21T13:43:21.000000Z'
      }
    };

    moxios.stubRequest('/api/v1/servers/1', {
      status: 200,
      response: serverResponse
    });
  });

  afterEach(function () {
    PermissionService.setCurrentUser(oldUser);
    moxios.uninstall();
  });

  it('input fields are disabled if the server is displayed in view mode', function (done) {
    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key, values) => key
      },
      propsData: {
        viewOnly: true,
        id: '1'
      },
      store
    });

    moxios.wait(function () {
      expect(view.findAllComponents(BFormInput).wrappers.every(input => input.attributes('disabled'))).toBe(true);
      expect(view.findAllComponents(BFormRating).wrappers.every(input => input.vm.disabled)).toBe(true);
      expect(view.findAllComponents(BFormCheckbox).wrappers.every(input => input.vm.disabled)).toBe(true);
      done();
    });
  });

  it('error handler gets called if an error occurs during load of data and reload button reloads data', function (done) {
    const spy = sinon.spy();
    sinon.stub(Base, 'error').callsFake(spy);

    const restoreServerResponse = overrideStub('/api/v1/servers/1', {
      status: 500,
      response: {
        message: 'Test'
      }
    });

    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key) => key
      },
      propsData: {
        viewOnly: false,
        id: '1'
      },
      store
    });

    moxios.wait(function () {
      sinon.assert.calledOnce(Base.error);
      expect(view.vm.isBusy).toBe(false);
      expect(view.findComponent(BOverlay).props('show')).toBe(true);
      Base.error.restore();
      restoreServerResponse();

      const reloadButton = view.findComponent({ ref: 'reloadServer' });
      expect(reloadButton.exists()).toBeTruthy();
      reloadButton.trigger('click');

      moxios.wait(function () {
        expect(view.vm.isBusy).toBe(false);
        expect(view.findComponent(BOverlay).props('show')).toBe(false);

        expect(view.vm.$data.model.id).toBe(1);
        expect(view.vm.$data.model.description).toEqual('Server 01');

        done();
      });
    });
  });

  it('error handler gets called and redirected if a 404 error occurs during load of data', function (done) {
    const routerSpy = sinon.spy();
    const router = new VueRouter();
    router.push = routerSpy;

    const spy = sinon.spy();
    sinon.stub(Base, 'error').callsFake(spy);

    const restoreServerResponse = overrideStub('/api/v1/servers/1', {
      status: 404,
      response: {
        message: 'Test'
      }
    });

    mount(View, {
      localVue,
      mocks: {
        $t: (key) => key
      },
      propsData: {
        viewOnly: false,
        id: '1'
      },
      store,
      router
    });

    moxios.wait(function () {
      sinon.assert.calledOnce(Base.error);
      sinon.assert.calledOnce(routerSpy);
      sinon.assert.calledWith(routerSpy, { name: 'settings.servers' });
      Base.error.restore();
      restoreServerResponse();

      done();
    });
  });

  it('error handler gets called and redirected if a 404 error occurs during save of data', function (done) {
    const routerSpy = sinon.spy();
    const router = new VueRouter();
    router.push = routerSpy;

    const spy = sinon.spy();
    sinon.stub(Base, 'error').callsFake(spy);

    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key) => key
      },
      propsData: {
        viewOnly: false,
        id: '1'
      },
      store,
      router
    });

    moxios.wait(function () {
      const restoreServerResponse = overrideStub('/api/v1/servers/1', {
        status: 404,
        response: {
          message: 'Test'
        }
      });

      view.findComponent(BForm).trigger('submit');

      moxios.wait(function () {
        sinon.assert.calledOnce(Base.error);
        Base.error.restore();
        sinon.assert.calledOnce(routerSpy);
        sinon.assert.calledWith(routerSpy, { name: 'settings.servers' });
        restoreServerResponse();
        done();
      });
    });
  });

  it('error handler gets called if an error occurs during update', function (done) {
    const spy = sinon.spy();
    sinon.stub(Base, 'error').callsFake(spy);

    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key) => key
      },
      propsData: {
        viewOnly: false,
        id: '1'
      },
      store
    });

    moxios.wait(function () {
      const restoreServerResponse = overrideStub('/api/v1/servers/1', {
        status: 500,
        response: {
          message: 'Test'
        }
      });

      view.findComponent(BForm).trigger('submit');

      moxios.wait(function () {
        sinon.assert.calledOnce(Base.error);
        Base.error.restore();
        restoreServerResponse();
        done();
      });
    });
  });

  it('back button causes a back navigation without persistence', function (done) {
    const spy = sinon.spy();

    const router = new VueRouter();
    router.push = spy;

    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key, values) => key
      },
      propsData: {
        viewOnly: false,
        id: '1'
      },
      store,
      router
    });

    const requestCount = moxios.requests.count();

    view.findAllComponents(BButton).filter(button => button.text() === 'app.back').at(0).trigger('click').then(() => {
      expect(moxios.requests.count()).toBe(requestCount);
      sinon.assert.calledOnce(spy);
      done();
    });
  });

  it('request with updates get send during saving the server', function (done) {
    const spy = sinon.spy();

    const router = new VueRouter();
    router.push = spy;

    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key, values) => key
      },
      propsData: {
        viewOnly: false,
        id: '1'
      },
      store,
      router
    });

    moxios.wait(async () => {
      await view.vm.$nextTick();
      await view.findAllComponents(BFormInput).at(0).setValue('Server 02');
      await view.findAllComponents(BFormInput).at(1).setValue('http://localhost/bbb');
      await view.findAllComponents(BFormInput).at(2).setValue('987654321');
      await view.findComponent(BFormRating).findAll('.b-rating-star').at(4).trigger('click');
      await view.findComponent(BFormCheckbox).find('input').setChecked();

      view.findComponent(BForm).trigger('submit');

      let restoreRoomTypeResponse = overrideStub('/api/v1/servers/1', {
        status: env.HTTP_UNPROCESSABLE_ENTITY,
        response: {
          message: 'The given data was invalid.',
          errors: {
            description: ['Test description'],
            base_url: ['Test base url'],
            salt: ['Test salt'],
            strength: ['Test strength'],
            disabled: ['Test disabled']
          }
        }
      });

      moxios.wait(function () {
        const request = moxios.requests.mostRecent();
        const data = JSON.parse(request.config.data);

        expect(data.description).toBe('Server 02');
        expect(data.base_url).toBe('http://localhost/bbb');
        expect(data.salt).toBe('987654321');
        expect(data.strength).toBe(5);
        expect(data.disabled).toBe(true);

        const feedback = view.findAllComponents(BFormInvalidFeedback).wrappers;
        expect(feedback[0].html()).toContain('Test description');
        expect(feedback[1].html()).toContain('Test base url');
        expect(feedback[2].html()).toContain('Test salt');
        expect(feedback[3].html()).toContain('Test strength');
        expect(feedback[4].html()).toContain('Test disabled');

        restoreRoomTypeResponse();
        restoreRoomTypeResponse = overrideStub('/api/v1/servers/1', {
          status: 204
        });

        view.findComponent(BForm).trigger('submit');

        moxios.wait(function () {
          sinon.assert.calledOnce(spy);
          restoreRoomTypeResponse();
          done();
        });
      });
    });
  });

  it('modal gets shown for stale errors and a overwrite can be forced', function (done) {
    const spy = sinon.spy();

    const router = new VueRouter();
    router.push = spy;

    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key, values) => key
      },
      propsData: {
        viewOnly: false,
        id: '1',
        modalStatic: true
      },
      store,
      router
    });

    moxios.wait(function () {
      const newModel = _.cloneDeep(view.vm.model);
      newModel.updated_at = '2020-09-08 16:13:26';

      let restoreRoomTypeResponse = overrideStub('/api/v1/servers/1', {
        status: env.HTTP_STALE_MODEL,
        response: {
          error: env.HTTP_STALE_MODEL,
          message: 'test',
          new_model: newModel
        }
      });

      view.findComponent(BForm).trigger('submit');

      moxios.wait(function () {
        const staleModelModal = view.findComponent({ ref: 'stale-server-modal' });
        expect(staleModelModal.vm.$data.isVisible).toBe(true);

        restoreRoomTypeResponse();
        restoreRoomTypeResponse = overrideStub('/api/v1/servers/1', {
          status: 204
        });

        staleModelModal.vm.$refs['ok-button'].click();

        moxios.wait(function () {
          const request = moxios.requests.mostRecent();
          const data = JSON.parse(request.config.data);

          expect(data.updated_at).toBe(newModel.updated_at);
          expect(view.findComponent(BModal).vm.$data.isVisible).toBe(false);

          done();
        });
      });
    });
  });

  it('modal gets shown for stale errors and the new model can be applied to current form', function (done) {
    const spy = sinon.spy();

    const router = new VueRouter();
    router.push = spy;

    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key, values) => key
      },
      propsData: {
        viewOnly: false,
        id: '1',
        modalStatic: true
      },
      store,
      router
    });

    moxios.wait(function () {
      const newModel = _.cloneDeep(view.vm.model);
      newModel.updated_at = '2020-09-08 16:13:26';
      newModel.description = 'Server 02';

      const restoreRoomTypeResponse = overrideStub('/api/v1/servers/1', {
        status: env.HTTP_STALE_MODEL,
        response: {
          error: env.HTTP_STALE_MODEL,
          message: 'test',
          new_model: newModel
        }
      });

      view.findComponent(BForm).trigger('submit');

      moxios.wait(function () {
        const staleModelModal = view.findComponent({ ref: 'stale-server-modal' });
        expect(staleModelModal.vm.$data.isVisible).toBe(true);
        expect(view.findAllComponents(BFormInput).at(0).element.value).toBe('Server 01');

        restoreRoomTypeResponse();

        staleModelModal.vm.$refs['cancel-button'].click();

        view.vm.$nextTick().then(() => {
          expect(view.findAllComponents(BFormInput).at(0).element.value).toBe('Server 02');
          expect(view.findComponent(BModal).vm.$data.isVisible).toBe(false);
          done();
        });
      });
    });
  });
});