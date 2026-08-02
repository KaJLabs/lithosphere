export const formatNumberToView = (number) => {
  // Convert the number to a string
  let numString = String(number);

  // Split the number into integer and decimal parts (if any)
  let parts = numString.split('.');
  let integerPart = parts[0];
  let decimalPart = parts[1] || '';

  // Add commas to the integer part
  let formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Concatenate the formatted integer part with the decimal part (if any)
  let formattedNumber = formattedIntegerPart + (decimalPart.length > 0 ? '.' + decimalPart : '');

  return formattedNumber;
}
