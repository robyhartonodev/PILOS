import View from '../../../../../resources/js/views/settings/roomTypes/View';
import { createLocalVue, mount } from '@vue/test-utils';
import PermissionService from '../../../../../resources/js/services/PermissionService';
import moxios from 'moxios';
import BootstrapVue, {
  IconsPlugin,
  BFormInput,
  BOverlay,
  BButton, BForm, BFormInvalidFeedback, BModal
} from 'bootstrap-vue';
import VSwatches from 'vue-swatches';
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

describe('RoomTypeView', function () {
  beforeEach(function () {
    oldUser = PermissionService.currentUser;
    PermissionService.setCurrentUser({ permissions: ['roomTypes.view', 'roomTypes.create', 'roomTypes.update', 'settings.manage'] });
    moxios.install();

    const roomTypeResponse = {
      data: {
        id: 1,
        short: 'ME',
        color: '#333333',
        description: 'Meeting',
        model_name: 'RoomType',
        updated_at: '2020-09-08 15:13:26'
      }
    };

    moxios.stubRequest('/api/v1/roomTypes/1', {
      status: 200,
      response: roomTypeResponse
    });
  });

  afterEach(function () {
    PermissionService.setCurrentUser(oldUser);
    moxios.uninstall();
  });

  it('room type description in title gets shown for detail view', function (done) {
    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key, values) => key === 'settings.roomTypes.view' ? `${key} ${values.name}` : key
      },
      propsData: {
        id: 1,
        viewOnly: true
      }
    });

    moxios.wait(function () {
      expect(view.html()).toContain('settings.roomTypes.view Meeting');
      done();
    });
  });

  it('room type description in title gets translated for update view', function (done) {
    const view = mount(View, {
      localVue,
      mocks: {
        $t: (key, values) => key === 'settings.roomTypes.edit' ? `${key} ${values.name}` : key
      },
      propsData: {
        viewOnly: false,
        id: '1'
      },
      store
    });

    moxios.wait(function () {
      expect(view.html()).toContain('settings.roomTypes.edit Meeting');
      done();
    });
  });

  it('input fields are disabled if the room type is displayed in view mode', function (done) {
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
      expect(view.findAllComponents(VSwatches).wrappers.every(input => input.vm.disabled)).toBe(true);
      done();
    });
  });

  it('error handler gets called if an error occurs during load of data and reload button reloads data', function (done) {
    const spy = sinon.spy();
    sinon.stub(Base, 'error').callsFake(spy);

    const restoreRoomTypeResponse = overrideStub('/api/v1/roomTypes/1', {
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
      restoreRoomTypeResponse();

      const reloadButton = view.findComponent({ ref: 'reloadRoomType' });
      expect(reloadButton.exists()).toBeTruthy();
      reloadButton.trigger('click');

      moxios.wait(function () {
        expect(view.vm.isBusy).toBe(false);
        expect(view.findComponent(BOverlay).props('show')).toBe(false);

        expect(view.vm.$data.model.id).toBe(1);
        expect(view.vm.$data.model.description).toEqual('Meeting');

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
      const restoreRoomTypeResponse = overrideStub('/api/v1/roomTypes/1', {
        status: 500,
        response: {
          message: 'Test'
        }
      });

      view.findComponent(BForm).trigger('submit');

      moxios.wait(function () {
        sinon.assert.calledOnce(Base.error);
        Base.error.restore();
        restoreRoomTypeResponse();
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

  it('request with updates get send during saving the room type', function (done) {
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

    moxios.wait(function () {
      view.vm.$nextTick().then(() => {
        const inputs = view.findAllComponents(BFormInput).wrappers;

        return inputs[0].setValue('Meeting').then(() => {
          return inputs[1].setValue('ME').then(() => {
            return inputs[2].setValue('#333333');
          });
        });
      }).then(() => {
        view.findComponent(BForm).trigger('submit');

        let restoreRoomTypeResponse = overrideStub('/api/v1/roomTypes/1', {
          status: env.HTTP_UNPROCESSABLE_ENTITY,
          response: {
            message: 'The given data was invalid.',
            errors: {
              description: ['Test description'],
              short: ['Test short'],
              color: ['Test color']
            }
          }
        });

        moxios.wait(function () {
          const request = moxios.requests.mostRecent();
          const data = JSON.parse(request.config.data);

          expect(data.description).toBe('Meeting');
          expect(data.short).toBe('ME');
          expect(data.color).toBe('#333333');

          const feedback = view.findAllComponents(BFormInvalidFeedback).wrappers;
          expect(feedback[0].html()).toContain('Test description');
          expect(feedback[1].html()).toContain('Test short');
          expect(feedback[2].html()).toContain('Test color');

          restoreRoomTypeResponse();
          restoreRoomTypeResponse = overrideStub('/api/v1/roomTypes/1', {
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

      let restoreRoomTypeResponse = overrideStub('/api/v1/roomTypes/1', {
        status: env.HTTP_STALE_MODEL,
        response: {
          error: env.HTTP_STALE_MODEL,
          message: 'test',
          new_model: newModel
        }
      });

      view.findComponent(BForm).trigger('submit');

      moxios.wait(function () {
        const staleModelModal = view.findComponent({ ref: 'stale-roomType-modal' });
        expect(staleModelModal.vm.$data.isVisible).toBe(true);

        restoreRoomTypeResponse();
        restoreRoomTypeResponse = overrideStub('/api/v1/roomTypes/1', {
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
      newModel.description = 'Test';

      const restoreRoomTypeResponse = overrideStub('/api/v1/roomTypes/1', {
        status: env.HTTP_STALE_MODEL,
        response: {
          error: env.HTTP_STALE_MODEL,
          message: 'test',
          new_model: newModel
        }
      });

      view.findComponent(BForm).trigger('submit');

      moxios.wait(function () {
        const staleModelModal = view.findComponent({ ref: 'stale-roomType-modal' });
        expect(staleModelModal.vm.$data.isVisible).toBe(true);
        expect(view.findAllComponents(BFormInput).at(0).element.value).toBe('Meeting');

        restoreRoomTypeResponse();

        staleModelModal.vm.$refs['cancel-button'].click();

        view.vm.$nextTick().then(() => {
          expect(view.findAllComponents(BFormInput).at(0).element.value).toBe('Test');
          expect(view.findComponent(BModal).vm.$data.isVisible).toBe(false);
          done();
        });
      });
    });
  });
});
