import * as unorm from "unorm";

export default function normalize(str: string, form: string = "NFC"): string {
  str = "" + str;
  if (form === "NFC") {
    return unorm.nfc(str);
  } else if (form === "NFD") {
    return unorm.nfd(str);
  } else if (form === "NFKC") {
    return unorm.nfkc(str);
  } else if (form === "NFKD") {
    return unorm.nfkd(str);
  } else {
    throw new RangeError("Invalid normalization form: " + form);
  }
}
