// panlang/src/runtime/core_runtime.c
// Core runtime functions for PanLang

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
// Include other standard library headers as needed (e.g., math.h, etc.)

// Function to print a string to the console
void core_runtime_print_string(const char* str) {
    if (str != NULL) {
        printf("%s\n", str);
    }
}

// Function to print an integer to the console
void core_runtime_print_int(int val) {
    printf("%d\n", val);
}

// Function to print a double/float to the console
void core_runtime_print_double(double val) {
    printf("%f\n", val);
}

// --- Other conceptual runtime functions ---
// These would be implemented based on PanLang's standard library requirements.

// Example: Basic arithmetic operation for runtime (if not handled directly by compiler)
int core_runtime_add_int(int a, int b) {
    return a + b;
}

// Example: Type conversion (conceptual)
// char* core_runtime_int_to_string(int val) {
//     char buffer[32]; // Sufficient for most ints
//     sprintf(buffer, "%d", val);
//     return strdup(buffer); // Remember to free this string later
// }

// ... other core runtime functions (e.g., memory management, array/object operations, string manipulation)
