import XML from "../examples/xml-ish";
import { snapTest } from "./util";

test("xml basic", () => {
  expect(XML.tryParse(`<a key="val" />`)).toEqual({
    name: "a",
    attributes: { key: "val" },
    children: [],
  });
  expect(XML.tryParse(`<a key="val">foo<b /></a>`)).toEqual({
    name: "a",
    attributes: { key: "val" },
    children: ["foo", { name: "b", attributes: {}, children: [] }],
  });
});

test("xml complex", () => {
  for (let i = 0; i < 1000; i++) {
    XML.parse(`
    <Map>
      <Entry key="string-a"><String>alpha</String></Entry>
      <Entry key="string-b"><String>bravo</String></Entry>
      <Entry key="string-c"><String>charlie</String></Entry>
      <Entry key="list">
        <List>
          <String>a</String>
          <String>b</String>
          <String>c</String>
        </List>
        <List>
          <String>a</String>
          <String>b</String>
          <String>c</String>
        </List>
        <List>
          <String>a</String>
          <String>b</String>
          <String>c</String>
        </List>
        <List>
          <String>a</String>
          <String>b</String>
          <String>c</String>
        </List>
      </Entry>
      <List>
        <String>a</String>
        <String>b</String>
        <String>c</String>
      </List>
      <Entry key="null"><Null /></Entry>
      <Entry key="empty" />
    </Map>
    `)
  }
})

test("xml large example", () => {
  snapTest(
    XML,
    `
    <Map>
      <Entry key="string-a"><String>alpha</String></Entry>
      <Entry key="string-b"><String>bravo</String></Entry>
      <Entry key="string-c"><String>charlie</String></Entry>
      <Entry key="list">
        <List>
          <String>a</String>
          <String>b</String>
          <String>c</String>
        </List>
      </Entry>
      <Entry key="null"><Null /></Entry>
      <Entry key="empty" />
    </Map>
    `
  );
});
