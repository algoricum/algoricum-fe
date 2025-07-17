import { createClient } from "@/utils/supabase/config/client";
import Papa from 'papaparse';

const downloadAndParseCSVWithPapa = async (bucketName, fileName) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(fileName);
  
      if (error) {
        console.error('Error downloading file:', error);
        return null;
      }
  
      const csvText = await data.text();
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true, // First row as headers
          skipEmptyLines: true,
          complete: (results) => {
            resolve({
              data: results.data,
              errors: results.errors,
              meta: results.meta
            });
          },
          error: (error) => {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
};

export default downloadAndParseCSVWithPapa;