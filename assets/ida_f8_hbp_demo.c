#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>

#if !defined(_M_X64)
#error Build this example for Windows x64 with MSVC.
#endif

CONTEXT g_context;
BOOL g_api_ok;
DWORD g_api_error;

__declspec(noinline) void capture_debug_registers(void)
{
    HANDLE current_thread = GetCurrentThread();

    ZeroMemory(&g_context, sizeof(g_context));
    g_context.ContextFlags = CONTEXT_DEBUG_REGISTERS;

    g_api_ok = GetThreadContext(current_thread, &g_context);
    g_api_error = g_api_ok ? ERROR_SUCCESS : GetLastError();
}

int main(void)
{
    DWORD64 addresses[4];
    unsigned int enabled_mask;
    int legacy_result;
    unsigned int i;

    puts("IDA F8: observing temporary hardware breakpoints");
    puts("Note: the API does not guarantee a valid context for the current thread.");

    capture_debug_registers();

    printf("\nGetThreadContext: %s\n", g_api_ok ? "success" : "failure");
    if (!g_api_ok) {
        printf("GetLastError: %lu\n", (unsigned long)g_api_error);
        return 1;
    }

    addresses[0] = g_context.Dr0;
    addresses[1] = g_context.Dr1;
    addresses[2] = g_context.Dr2;
    addresses[3] = g_context.Dr3;

    legacy_result = (g_context.Dr0 != 0 || g_context.Dr1 != 0 ||
                     g_context.Dr2 != 0 || g_context.Dr3 != 0);

    enabled_mask = (unsigned int)(g_context.Dr7 & 0xFFu);

    printf("ContextFlags = 0x%08lX\n", (unsigned long)g_context.ContextFlags);
    printf("Dr6          = 0x%016llX\n", (unsigned long long)g_context.Dr6);
    printf("Dr7          = 0x%016llX\n", (unsigned long long)g_context.Dr7);

    for (i = 0; i < 4; ++i) {
        unsigned int local = (enabled_mask >> (2u * i)) & 1u;
        unsigned int global = (enabled_mask >> (2u * i + 1u)) & 1u;
        printf("Dr%u          = 0x%016llX  L%u=%u G%u=%u  [%s]\n",
               i, (unsigned long long)addresses[i], i, local, i, global,
               (local || global) ? "enabled in snapshot" : "disabled in snapshot");
    }

    printf("\nOriginal check (Dr0..Dr3 != 0): %s\n",
           legacy_result ? "true" : "false");
    printf("Enable bits (Dr7 & 0xFF): 0x%02X\n", enabled_mask);
    printf("Any slot enabled in snapshot: %s\n",
           enabled_mask ? "true" : "false");
    puts("\nCompare the enabled DrN with the instruction immediately after the CALL.");
    puts("Repeat the call after changing the IDA option: the previous snapshot is unchanged.");

    return 0;
}
