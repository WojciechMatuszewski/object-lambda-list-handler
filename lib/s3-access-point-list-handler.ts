import fetch from "node-fetch";

interface Event {
  listObjectsContext: {
    inputS3Url: string;
  };
}

export const handler = async (event: Event) => {
  console.log({ event: JSON.stringify(event) });

  try {
    const response = await fetch(event.listObjectsContext.inputS3Url);
    const xml = await response.text();

    console.log(xml);

    return {
      statusCode: 200,
      listResultXml: xml
    };
  } catch (e) {
    return {
      statusCode: 500,
      errorCode: (e as Error).name,
      errorMessage: (e as Error).message
    };
  }
};
