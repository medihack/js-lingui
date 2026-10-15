import { compileMessage as compile } from "@lingui/message-utils/compileMessage"
import { interpolate } from "./interpolate"
import { Locale, Locales } from "./i18n"

describe("interpolate", () => {
  const prepare = (translation: string, locale?: Locale, locales?: Locales) => {
    const tokens = compile(translation)
    return interpolate(tokens, locale || "en", locales)
  }

  it("should process string chunks with provided map fn", () => {
    const tokens = compile(
      "Message {value, plural, one {{value} Book} other {# Books}}",
      (text) => `<${text}>`,
    )
    expect(tokens).toEqual([
      "<Message >",
      [
        "value",
        "plural",
        {
          one: [["value"], "< Book>"],
          other: ["#", "< Books>"],
        },
      ],
    ])
  })

  it("should interpolate message with variable", () => {
    const cache = compile("Hey {name}!")
    expect(interpolate(cache, "en", [])({ name: "Joe" })).toEqual("Hey Joe!")
  })

  it("should not interpolate escaped placeholder", () => {
    const msg = prepare("Hey '{name}'!")

    expect(msg({ name: "Joe" })).toEqual("Hey {name}!")
  })

  it("should interpolate plurals", () => {
    const plural = prepare(
      "{value, plural, one {{value} Book} =4 {Four books} =99 { Books with problems } other {# Books}}",
    )
    expect(plural({ value: 1 })).toEqual("1 Book")
    expect(plural({ value: 2 })).toEqual("2 Books")
    expect(plural({ value: 4 })).toEqual("Four books")
    expect(plural({ value: 99 })).toEqual(" Books with problems ")

    const offset = prepare(
      "{value, plural, offset:1 =0 {No Books} one {# Book} other {# Books}}",
    )
    expect(offset({ value: 0 })).toEqual("No Books")
    expect(offset({ value: 2 })).toEqual("1 Book")
    expect(offset({ value: 3 })).toEqual("2 Books")
  })

  it("should interpolate plurals with falsy value choice", () => {
    const plural = prepare("{value, plural, one {} other {# Books}}")
    expect(plural({ value: 1 })).toEqual("")
    expect(plural({ value: 2 })).toEqual("2 Books")
  })

  it("should not replace `#` symbol passed in the variable in the jsx expression", () => {
    const plural = prepare(
      "{value, plural, one {There is a notification in <1>{documentTitle}</1>} other {There are # notifications in <1>{documentTitle}</1>}}",
    )

    expect(plural({ value: 1, documentTitle: "Title #1" })).toEqual(
      "There is a notification in <1>Title #1</1>",
    )
    expect(plural({ value: 2, documentTitle: "Title #1" })).toEqual(
      "There are 2 notifications in <1>Title #1</1>",
    )
  })

  it("should not replace `#` symbol outside plural and selectordinal", () => {
    const cache = compile("#{place} in best seller list")
    expect(interpolate(cache, "en", [])({ place: 7 })).toEqual(
      "#7 in best seller list",
    )
  })

  it("should replace more than one octothorpe symbols in message", () => {
    const plural = prepare("{value, plural, one {} other {# and #}}")

    expect(plural({ value: 2 })).toEqual("2 and 2")
  })

  it("when a value is defined (even when empty) plural will return it. Conversely, if a value is not defined, plural defaults to 'other'", () => {
    const plural = prepare("{value, plural, =0 {} other {#% discount}}")
    expect(plural({ value: 0 })).toEqual("")
    expect(plural({ value: 1 })).toEqual("1% discount")
    expect(plural({ value: 30 })).toEqual("30% discount")
  })

  it("should interpolate selectordinal", () => {
    const cache = prepare(
      "{value, selectordinal, one {#st Book} two {#nd Book}}",
    )
    expect(cache({ value: 1 })).toEqual("1st Book")
    expect(cache({ value: 2 })).toEqual("2nd Book")
  })

  it("should support nested choice components", () => {
    const cache = prepare(
      `{
      gender, select,
      male {{numOfGuests, plural, one {He invites one guest} other {He invites # guests}}}
      female {{numOfGuests, plural, one {She invites one guest} other {She invites # guests}}}
      other {They is {gender}}}`,
    )

    expect(cache({ numOfGuests: 1, gender: "male" })).toEqual(
      "He invites one guest",
    )
    expect(cache({ numOfGuests: 3, gender: "male" })).toEqual(
      "He invites 3 guests",
    )
    expect(cache({ numOfGuests: 1, gender: "female" })).toEqual(
      "She invites one guest",
    )
    expect(cache({ numOfGuests: 3, gender: "female" })).toEqual(
      "She invites 3 guests",
    )
    expect(cache({ numOfGuests: 3, gender: "unknown" })).toEqual(
      "They is unknown",
    )
  })

  it("should interpolate select", () => {
    const cache = prepare("{value, select, female {She} other {They}}")
    expect(cache({ value: "female" })).toEqual("She")
    expect(cache({ value: "n/a" })).toEqual("They")
  })

  it("should support select with empty string choice", () => {
    const cache = prepare("{value, select, female {} other {They}}")
    expect(cache({ value: "female" })).toEqual("")
    expect(cache({ value: "n/a" })).toEqual("They")
    const cache2 = prepare("{value, select, female {0} other {They}}")
    expect(cache2({ value: "female" })).toEqual("0")
    expect(cache2({ value: "n/a" })).toEqual("They")
  })

  it("should use the other choice for a value inherited from Object.prototype", () => {
    const cache = prepare("{value, select, female {She} other {They}}")
    expect(cache({ value: "constructor" })).toEqual("They")
    expect(cache({ value: "toString" })).toEqual("They")
    expect(cache({ value: "hasOwnProperty" })).toEqual("They")
  })

  describe("Custom format", () => {
    const testVector = [
      ["en", undefined, "0.1", "10%", "20%", "€0.10", "€1.00"],
      ["fr", undefined, "0,1", "10 %", "20 %", "0,10 €", "1,00 €"],
      ["fr", "fr-CH", "0,1", "10%", "20%", "0.10 €", "1.00 €"],
    ] as const
    testVector.forEach((tc) => {
      const [
        locale,
        locales,
        expectedNumber,
        expectedPercent1,
        expectedPercent2,
        expectedCurrency1,
        expectedCurrency2,
      ] = tc

      it(`should interpolate custom format for locale=${locale} and locales=${locales}`, () => {
        const number = prepare("{value, number}", locale, locales)
        expect(number({ value: 0.1 })).toEqual(expectedNumber)

        const percent = prepare("{value, number, percent}", locale, locales)
        expect(percent({ value: 0.1 })).toEqual(expectedPercent1)
        expect(percent({ value: 0.2 })).toEqual(expectedPercent2)

        const formats = {
          currency: {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
          } satisfies Intl.NumberFormatOptions,
        }
        const currency = prepare("{value, number, currency}", locale, locales)
        expect(currency({ value: 0.1 }, formats)).toEqual(expectedCurrency1)
        expect(currency({ value: 1 }, formats)).toEqual(expectedCurrency2)
      })
    })
  })

  it("should not crash on a unicode sequences", () => {
    const cache = compile("Hey {name}!")
    expect(interpolate(cache, "en", [])({ name: "Joe\\xaa" })).toEqual(
      "Hey Joe\\xaa!",
    )
  })

  it("should not crash on a unicode sequences if the same string goes twice in a row", () => {
    const cache = compile("Hey {name}!")
    expect(interpolate(cache, "en", [])({ name: "Joe\\xaa" })).toEqual(
      "Hey Joe\\xaa!",
    )
    expect(interpolate(cache, "en", [])({ name: "Joe\\xaa" })).toEqual(
      "Hey Joe\\xaa!",
    )
  })

  describe("escape sequences", () => {
    it("should not decode escape sequences in interpolated values", () => {
      const msg = prepare("Open {name} failed")
      expect(msg({ name: "C:\\scans\\x64\\report.pdf" })).toEqual(
        "Open C:\\scans\\x64\\report.pdf failed",
      )
      expect(msg({ name: "Schilddr\\u00fcse.pdf" })).toEqual(
        "Open Schilddr\\u00fcse.pdf failed",
      )
    })

    it("should not decode escape sequences in values inside plural branches", () => {
      const msg = prepare(
        "{count, plural, one {# file: {name}} other {# files: {name}}}",
      )
      expect(msg({ count: 1, name: "C:\\scans\\x64" })).toEqual(
        "1 file: C:\\scans\\x64",
      )
      expect(msg({ count: 2, name: "Schilddr\\u00fcse" })).toEqual(
        "2 files: Schilddr\\u00fcse",
      )
    })

    it("should decode escape sequences in the message text", () => {
      const msg = prepare("Literal\\u00A0text\\x21 {name}")
      expect(msg({ name: "\\x64" })).toEqual("Literal\u00A0text! \\x64")
    })

    it("should decode escape sequences in the message text of plural branches", () => {
      const msg = prepare(
        "{count, plural, one {#\\u00A0file {name}} other {#\\x20files {name}}}",
      )
      expect(msg({ count: 1, name: "\\x64" })).toEqual("1\u00A0file \\x64")
      expect(msg({ count: 2, name: "\\u00fc" })).toEqual("2 files \\u00fc")
    })

    it("should not form an escape sequence across adjacent placeholders", () => {
      const msg = prepare("{first}{second}")
      expect(msg({ first: "\\u00", second: "fc" })).toEqual("\\u00fc")
      expect(msg({ first: "\\x", second: "64" })).toEqual("\\x64")
    })
  })

  describe("default variables", () => {
    it("should interpolate default variables when values are not provided", () => {
      const cache = compile("Hello {name} from {appName}!")
      expect(
        interpolate(cache, "en", [])({}, undefined, {
          name: "World",
          appName: "Lingui",
        }),
      ).toEqual("Hello World from Lingui!")
    })

    it("should prioritize caller-provided values over default variables", () => {
      const cache = compile("Hello {name}!")
      expect(
        interpolate(cache, "en", [])({ name: "Alice" }, undefined, {
          name: "Bob",
        }),
      ).toEqual("Hello Alice!")

      expect(
        interpolate(cache, "en", [])({ name: undefined }, undefined, {
          name: "Bob",
        }),
      ).toEqual("Hello Bob!")
    })

    it("should evaluate function variables on demand", () => {
      let callCount = 0
      const cache = compile("Hello {name}!")
      const format = interpolate(cache, "en", [])
      const variables = {
        name: () => {
          callCount++
          return "Dynamic"
        },
        unused: () => {
          throw new Error("should not be called")
        },
      }

      expect(format({}, undefined, variables)).toEqual("Hello Dynamic!")
      expect(callCount).toEqual(1)
    })

    it("should not call functions passed in values", () => {
      const cache = compile("Hello {name}!")
      const format = interpolate(cache, "en", [])
      const fn = vi.fn(() => "ShouldNotBeCalled")

      format({ name: fn }, undefined, { name: "Default" })
      expect(fn).not.toHaveBeenCalled()
    })
  })
})
