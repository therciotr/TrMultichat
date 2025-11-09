import axios from "axios";

const baseURL = process.env.API_BASE_URL || "http://localhost:4004";

function expectShapeKeys(obj: any, keys: string[]) {
  for (const k of keys) expect(Object.prototype.hasOwnProperty.call(obj, k)).toBe(true);
}

describe("API basic shapes", () => {
  it("/contacts/ returns {contacts, hasMore}", async () => {
    const { data } = await axios.get(`${baseURL}/contacts/`);
    expectShapeKeys(data, ["contacts", "hasMore"]);
    expect(Array.isArray(data.contacts)).toBe(true);
  });

  it("/users/ returns {users, hasMore}", async () => {
    const { data } = await axios.get(`${baseURL}/users/`);
    expectShapeKeys(data, ["users", "hasMore"]);
    expect(Array.isArray(data.users)).toBe(true);
  });

  it("/queue returns array", async () => {
    const { data } = await axios.get(`${baseURL}/queue`);
    expect(Array.isArray(data)).toBe(true);
  });

  it("/files/ returns {files, hasMore}", async () => {
    const { data } = await axios.get(`${baseURL}/files/`);
    expectShapeKeys(data, ["files", "hasMore"]);
    expect(Array.isArray(data.files)).toBe(true);
  });

  it("/quick-messages returns {records, hasMore}", async () => {
    const { data } = await axios.get(`${baseURL}/quick-messages`);
    expectShapeKeys(data, ["records", "hasMore"]);
    expect(Array.isArray(data.records)).toBe(true);
  });
});





