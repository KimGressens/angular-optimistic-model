describe('Model', function () {
    var $httpBackend;
    var Model = null;
    var Person;
    var callAccount;

    beforeEach(module('rt.optimisticmodel'));

    beforeEach(inject(function ($injector, $http) {
        $httpBackend = $injector.get('$httpBackend');

        callAccount = function callAccount(method, url, data) {
            return $http({
                method: method,
                url: url,
                data: data,
            }).then(function (result) { return result.data; });
        };

        Model = $injector.get('Model');
        Model.defaults({
            backend: callAccount
        });

        Person = function Person() {
        };

        Model.extend(Person, {
            ns: '/api/people'
        });

        Person.prototype.getFullName = function () {
            return this.first_name + ' ' + this.last_name;
        };
    }));

    afterEach(function () {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    it('Has an extend method', function () {
        assert.isFunction(Model.extend);
        assert.equal(Person.modelOptions.ns, '/api/people');
    });

    it('Has a defaults method', function () {
        assert.isFunction(Model.defaults);
        assert.equal(Person.modelOptions.backend, callAccount);
    });

    it('Has a static getAll method', function () {
        assert.isFunction(Person.getAll);
    });

    it('Has a static get method', function () {
        assert.isFunction(Person.get);
    });

    it('getAll fetches all models from the backend', function () {
        var called = false;
        Person.getAll().then(function (people) {
            called = true;
            assert.equal(people.length, 1);
            assert.equal(people[0].constructor, Person);
            assert.equal(people[0].id, 123);
            assert.equal(people[0].first_name, 'Ruben');
        });
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' }
        ]);
        $httpBackend.flush();
        assert(called);
    });

    it('toScope: Scope gets pre-filled if we already have a cached copy', function () {
        // Fill cache
        Person.getAll();
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' }
        ]);
        $httpBackend.flush();

        // Request it again somewhere else
        var scope = {};
        Person.getAll().toScope(scope, 'people');

        // Should be on scope now
        assert.equal(scope.people.length, 1);
        assert.equal(scope.people[0].constructor, Person);
        assert.equal(scope.people[0].id, 123);
        assert.equal(scope.people[0].first_name, 'Ruben');

        // Scope gets updated when results come in
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 124, first_name: 'Joe' }
        ]);
        $httpBackend.flush();
        assert.equal(scope.people.length, 1);
        assert.equal(scope.people[0].constructor, Person);
        assert.equal(scope.people[0].id, 124);
        assert.equal(scope.people[0].first_name, 'Joe');
    });

    it('toScope: Updates scope objects in place', function () {
        var result = null;
        Person.get(123).then(function (obj) {
            result = obj;
        });
        $httpBackend.expectGET('/api/people/123').respond(200, { id: 123, first_name: 'Ruben' });
        $httpBackend.flush();

        var scope = {};
        var result2 = null;
        Person.get(123).toScope(scope, 'person').then(function (obj) {
            result2 = obj;
        });
        assert.equal(scope.person.first_name, 'Ruben');
        $httpBackend.expectGET('/api/people/123').respond(200, { id: 123, first_name: 'Joe' });
        $httpBackend.flush();

        assert.equal(scope.person.id, 123);
        assert.equal(scope.person.first_name, 'Joe');
        assert.equal(scope.person.constructor, Person);
        assert.equal(scope.person, result);
        assert.equal(result2, result);
    });

    it('toScope: Updates scope arrays in place', function () {
        // Fill cache
        var result = null;
        Person.getAll().then(function (obj) {
            result = obj;
        });
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' },
            { id: 124, first_name: 'Joe' }
        ]);
        $httpBackend.flush();

        // Fetch array
        var scope = {};
        var result2 = null;
        Person.getAll().toScope(scope, 'people').then(function (obj) {
            result2 = obj;
            assert.equal(result2, result);
        });
        assert.equal(scope.people, result);
        assert.equal(scope.people[0].first_name, 'Ruben');

        // Respond to call
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Bart' },
            { id: 124, first_name: 'Alice' }
        ]);
        $httpBackend.flush();

        assert.equal(scope.people[0].id, 123);
        assert.equal(scope.people[0].first_name, 'Bart');
        assert.equal(scope.people[0].constructor, Person);
        assert.equal(scope.people, result);
        assert.equal(result2, result);
    });

    it('toScope: Uses results from getAll to pre-populate get', function () {
        // Fill cache
        Person.getAll();
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' },
            { id: 124, first_name: 'Joe' }
        ]);
        $httpBackend.flush();

        // Do GET
        var scope = {};
        var result = null;
        Person.get(123).toScope(scope, 'person').then(function (obj) {
            result = obj;
        });
        assert.equal(scope.person.first_name, 'Ruben');

        // Update with real result
        $httpBackend.expectGET('/api/people/123').respond(200, { id: 123, first_name: 'New' });
        $httpBackend.flush();

        assert.equal(result.first_name, 'New');
        assert.equal(scope.person, result);
    });

    it('Can disable pre-populate', function () {
        function Objects() {}

        Model.extend(Objects, {
            ns: '/api/objects',
            populateChildren: false
        });

        Objects.getAll();
        $httpBackend.expectGET('/api/objects').respond(200, [
            { id: 123, val: 'Test' },
        ]);
        $httpBackend.flush();

        var scope = {};
        var result = null;
        Objects.get(123).toScope(scope, 'obj').then(function (obj) {
            result = obj;
        });

        // Expect a cache miss
        assert.equal(scope.obj, undefined);

        // Update with real result
        $httpBackend.expectGET('/api/objects/123').respond(200, { id: 123, val: 'New' });
        $httpBackend.flush();

        assert.equal(scope.obj.val, 'New');
        assert.equal(scope.obj, result);
    });

    it('Supports toJSON', function () {
        function Document() {}
        Model.extend(Document, { ns: '/api/documents' });
        Document.prototype.toJSON = function () { return { body: 'bogus' }; };

        var doc = new Document();
        doc.id = 2;
        doc.update();

        $httpBackend.expectPUT('/api/documents/2', { body: 'bogus' }).respond(200);
        $httpBackend.flush();
    });

    it('Can update statically', function () {
        Person.update({ id: 3, first_name: 'Test' });
        $httpBackend.expectPUT('/api/people/3', { id: 3, first_name: 'Test' }).respond(200);
        $httpBackend.flush();
    });

    it('Can select update fields', function () {
        Person.update({ id: 3, first_name: 'Test' }, ['first_name']);
        $httpBackend.expectPUT('/api/people/3', { first_name: 'Test' }).respond(200);
        $httpBackend.flush();
    });

    it('Supports fromJSON', function () {
        function Document() {}
        Model.extend(Document, { ns: '/api/documents' });
        Document.prototype.fromJSON = function (data) {
            this.body = data.body.toUpperCase();
        };

        var called = false;
        Document.get(123).then(function (doc) {
            called = true;
            assert.equal(doc.body, 'BOGUS');
        });

        $httpBackend.expectGET('/api/documents/123').respond(200, { body: 'bogus' });
        $httpBackend.flush();

        assert(called);
    });

    it('Has a clear method to wipe the cache', function () {
        assert.isFunction(Model.clear);
    });

    it('Can delete objects', function () {
        var joe = new Person();
        joe.id = 123;
        joe.delete();
        $httpBackend.expectDELETE('/api/people/123').respond(200);
        $httpBackend.flush();
    });

    it('Can delete objects (static)', function () {
        Person.delete({ id: 123 });
        $httpBackend.expectDELETE('/api/people/123').respond(200);
        $httpBackend.flush();
    });

    it('Can delete objects (by id)', function () {
        Person.delete(123);
        $httpBackend.expectDELETE('/api/people/123').respond(200);
        $httpBackend.flush();

        Person.delete('124');
        $httpBackend.expectDELETE('/api/people/124').respond(200);
        $httpBackend.flush();
    });

    it('Delete removes the object from the parent collection', function () {
        var scope = {};
        Person.getAll().toScope(scope, 'people');
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' },
            { id: 124, first_name: 'Test' }
        ]);
        $httpBackend.flush();

        // Got loaded, delete it
        assert.equal(scope.people.length, 2);
        scope.people[1].delete();
        $httpBackend.expectDELETE('/api/people/124').respond(200);
        $httpBackend.flush();

        var scope2 = {};
        Person.getAll().toScope(scope2, 'people');

        // Should be on scope now, before request loads
        assert.equal(scope2.people.length, 1);
        assert.equal(scope2.people[0].constructor, Person);
        assert.equal(scope2.people[0].id, 123);
        assert.equal(scope2.people[0].first_name, 'Ruben');

        // Flush call
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' }
        ]);
        $httpBackend.flush();
    });

    it('Delete removes the object from the parent collection (static)', function () {
        Person.getAll();
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' },
            { id: 124, first_name: 'Test' }
        ]);
        $httpBackend.flush();

        Person.delete(124);
        $httpBackend.expectDELETE('/api/people/124').respond(200);
        $httpBackend.flush();

        var scope = {};
        Person.getAll().toScope(scope, 'people');

        // Should be on scope now, before request loads
        assert.equal(scope.people.length, 1);
        assert.equal(scope.people[0].constructor, Person);
        assert.equal(scope.people[0].id, 123);
        assert.equal(scope.people[0].first_name, 'Ruben');

        // Flush call
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' }
        ]);
        $httpBackend.flush();
    });

    it('Can create objects', function () {
        var joe = new Person();
        joe.id = 123;
        joe.create();
        $httpBackend.expectPOST('/api/people', { id: 123 }).respond(200);
        $httpBackend.flush();
    });

    it('Can create objects (static)', function () {
        Person.create({ id: 123 });
        $httpBackend.expectPOST('/api/people', { id: 123 }).respond(200);
        $httpBackend.flush();
    });

    it('Create adds the object to the parent collection', function () {
        Person.getAll();
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' }
        ]);
        $httpBackend.flush();

        Person.create({ first_name: 'Test' });
        $httpBackend.expectPOST('/api/people', { first_name: 'Test' }).respond({
            id: 124,
            first_name: 'Test'
        });
        $httpBackend.flush();

        var scope = {};
        Person.getAll().toScope(scope, 'people');

        // Should be on scope now, before request loads
        assert.equal(scope.people.length, 2);
        assert.equal(scope.people[0].constructor, Person);
        assert.equal(scope.people[0].id, 123);
        assert.equal(scope.people[0].first_name, 'Ruben');
        assert.equal(scope.people[1].constructor, Person);
        assert.equal(scope.people[1].id, 124);
        assert.equal(scope.people[1].first_name, 'Test');

        // Flush call
        $httpBackend.expectGET('/api/people').respond(200, [
            { id: 123, first_name: 'Ruben' },
            { id: 124, first_name: 'Test' }
        ]);
        $httpBackend.flush();
    });

    it('Can pre-fill the cache', function () {
        var joe = new Person();
        joe.id = 123;
        joe.first_name = 'Joe';
        Model.cache('/api/people/123', joe);

        var scope = {};
        var result = null;
        Person.get(123).toScope(scope, 'person').then(function (obj) {
            result = obj;
        });

        assert.equal(scope.person.first_name, 'Joe');
        assert.equal(scope.person, joe);

        $httpBackend.expectGET('/api/people/123').respond(200, { id: 123, first_name: 'Bob' });
        $httpBackend.flush();
        assert.equal(result, joe);
        assert.equal(scope.person.first_name, 'Bob');
    });
});