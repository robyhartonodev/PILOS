<?php

namespace App\Http\Controllers\api\v1;

use App\Enums\CustomStatusCodes;
use App\Http\Controllers\Controller;
use App\Http\Requests\RoleRequest;
use App\Permission;
use App\Http\Resources\Role as RoleResource;
use App\Role;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RoleController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Role::class, 'role');
    }

    /**
     * Display a listing of the resource.
     *
     * @return AnonymousResourceCollection
     */
    public function index()
    {
        $resource = Role::paginate(setting('pagination_page_size'));
        return RoleResource::collection($resource);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param RoleRequest $request
     * @return JsonResponse|void
     */
    public function store(RoleRequest $request)
    {
        $role = new Role;
        $role->name = $request->name;
        $role->default = false;

        if (!$role->save()) {
            return response()->json([
                'error' => 400,
                'message' => trans('app.save_failed', ['model' => trans('app.model.roles')])
            ], 400);
        }

        $role->permissions()->sync($request->permissions);
    }

    /**
     * Display the specified resource.
     *
     * @param Role $role
     * @return RoleResource
     */
    public function show(Role $role)
    {
        $role->load('permissions');
        return new RoleResource($role);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param Request $request
     * @param Role $role
     * @return JsonResponse|void
     */
    public function update(Request $request, Role $role)
    {
        $required_permissions = [
            'settings.manage',
            'roles.update',
            'roles.viewAny'
        ];

        $old_role_permissions = $role->permissions()->pluck('permissions.id')->toArray();

        $role->permissions()->sync($request->permissions);

        $user = Auth::user();
        $user->unsetRelation('roles');

        if (array_intersect($required_permissions, $user->permissions) !== $required_permissions) {
            $role->permissions()->sync($old_role_permissions);

            return response()->json([
                'error' => CustomStatusCodes::ROLE_UPDATE_PERMISSION_LOST,
                'message' => trans('app.errors.role_update_permission_lost')
            ], CustomStatusCodes::ROLE_UPDATE_PERMISSION_LOST);
        }

        $role->name = $request->name;
        if (!$role->save()) {
            return response()->json([
                'error' => 400,
                'message' => trans('app.save_failed', ['model' => trans('app.model.roles')])
            ], 400);
        }
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param Role $role
     * @return JsonResponse|void
     * @throws Exception
     */
    public function destroy(Role $role)
    {
        $role->loadCount('users');
        if ($role->users_count != 0) {
            return response()->json([
                'error' => CustomStatusCodes::ROLE_DELETE_LINKED_USERS,
                'message' => trans('app.errors.role_delete_linked_users')
            ], CustomStatusCodes::ROLE_DELETE_LINKED_USERS);
        }

        if (!$role->delete()) {
            return response()->json([
                'error' => 400,
                'message' => trans('app.delete_failed', ['model' => trans('app.model.roles')])
            ], 400);
        }
    }
}
