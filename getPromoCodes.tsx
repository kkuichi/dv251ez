import { doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

interface PromoCode {
  id: string;
  code: string;
  Promo_name: string;
}

export const fetchPromoCodes = async (
  selectedResort: string | null,
  ZSL_code: string
): Promise<PromoCode[]> => {
  const db = getFirestore();
  if (!selectedResort) {
    console.error("Selected resort is null.");
    return [];
  }

  try {
    console.log("Fetching promo codes for resort:", selectedResort); // Debugging log
    const resortDoc = await getDoc(doc(db, "resorts", selectedResort));
    if (resortDoc.exists()) {
      const data = resortDoc.data();
      const promoCodesData = data.promocodes.map(
        (promo: any, index: number) => ({
          id: index.toString(),
          code: promo.Code,
          Promo_name: promo.Promo_name,
        })
      );
      console.log("Fetched promo codes:", promoCodesData); // Debugging log
      console.log("ZSL code:", ZSL_code);

      const filteredPromoCodes = promoCodesData.filter((promo: PromoCode) =>
        ZSL_code
          ? promo.Promo_name === "trening_ZSL"
          : promo.Promo_name === "trening_WW"
      );

      console.log("Filtered promo codes:", filteredPromoCodes); // Debugging log

      // Ensure the array size matches the tickets variable
      if (filteredPromoCodes.length > 0) {
        return [filteredPromoCodes[0]];
      } else {
        console.error("Not enough promo codes available.");
        return filteredPromoCodes;
      }
    } else {
      console.log("No such document!");
      return [];
    }
  } catch (error) {
    console.error("Chyba napájania kolekcie promocodes: ", error);
    return [];
  }
};

export const deletePromoCodes = async (
  selectedResort: string | null,
  promoCodes: PromoCode[]
) => {
  const db = getFirestore();
  if (!selectedResort) {
    console.error("Selected resort is null.");
    return;
  }

  try {
    const resortDocRef = doc(db, "resorts", selectedResort);
    const resortDoc = await getDoc(resortDocRef);
    if (resortDoc.exists()) {
      const data = resortDoc.data();
      const updatedPromoCodes = data.promocodes.filter(
        (promo: any) => !promoCodes.some((code) => code.code === promo.Code)
      );
      await updateDoc(resortDocRef, { promocodes: updatedPromoCodes });
      console.log("Deleted promo codes:", promoCodes);
    }
  } catch (error) {
    console.error("Error deleting promo codes: ", error);
  }
};
