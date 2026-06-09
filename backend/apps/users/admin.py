from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User


class FinCalcUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'date_joined', 'last_login', 'is_active', 'is_staff')
    list_filter = ('is_active', 'is_staff', 'date_joined')
    list_editable = ('is_active',)
    ordering = ('-date_joined',)
    actions = ['enable_users', 'disable_users']

    @admin.action(description='Enable selected users')
    def enable_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} user(s) enabled.')

    @admin.action(description='Disable selected users')
    def disable_users(self, request, queryset):
        updated = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, f'{updated} user(s) disabled.')


admin.site.unregister(User)
admin.site.register(User, FinCalcUserAdmin)
