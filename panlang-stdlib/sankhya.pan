# panlang-stdlib/sankhya.pan
# Standard Library: Mathematical and Numeric Functions

# A module for general numeric operations
modula Sankhya {

    # Function to add two numbers
    lakshana("This function returns the sum of two numbers (a and b).")
    function yoga(a, b) {
        return a + b;
    }

    # Function to subtract two numbers
    lakshana("This function returns the difference between two numbers (a minus b).")
    function viyaga(a, b) {
        return a - b;
    }

    # Function to multiply two numbers
    lakshana("This function returns the product of two numbers (a and b).")
    function guna(a, b) {
        return a * b;
    }

    # Function to divide two numbers
    lakshana("This function returns the quotient of two numbers (a divided by b).")
    function bhaga(a, b) {
        # Simple error handling for division by zero
        if (b == 0) {
            # In a real system, this would throw a runtime error or return a special value
            print("त्रुटि: शून्य से विभाजन संभव नहीं है। (Error: Division by zero is not allowed.)");
            return 0; # Placeholder return
        }
        return a / b;
    }

    # Function to calculate power (a to the power of b)
    lakshana("This function returns the result of 'a' raised to the power of 'b'.")
    function shakti(base, exponent) {
        let result = 1;
        # Basic loop for positive integer exponents
        for (let i = 0; i < exponent; i = i + 1) {
            result = result * base;
        }
        return result;
    }

    # Type definition for a natural number
    prakar PrakritaSankhya = number;
    vinirgam PrakritaSankhya; # Export this type

    vinirgam yoga; # Export the yoga function
    vinirgam viyaga;
    vinirgam guna;
    vinirgam bhaga;
    vinirgam shakti;
}
