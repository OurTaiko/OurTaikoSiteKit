package tja

import "testing"

func TestSongHeader(t *testing.T) {
	cases := map[string]string{
		"TITLE:A\nWAVE:a.ogg\n#START\n1,\n#END\n":                                "",
		"TITLE:A\nPREIMAGE:jacket.png\nWAVE:a.ogg\n#START\n":                     "jacket.png",
		"TITLE:A\npreimage: img/jacket.png // art\r\nWAVE:a.ogg\r\n#START\r\n":   "img/jacket.png",
		"TITLE:A\nPREIMAGE:a.png\nPREIMAGE:b.png\nWAVE:a.ogg\n#START\n":          "b.png",
		"TITLE:A\nWAVE:a.ogg\n#START\nPREIMAGE:late.png\n1,\n#END\n":             "",
		"TITLE:A\nBGIMAGE:bg.png\nWAVE:a.ogg\nCOURSE:Oni\nLEVEL:1\n#START\n1,\n": "",
	}
	for in, want := range cases {
		if got := SongHeader([]byte(in), "PREIMAGE"); got != want {
			t.Errorf("SongHeader(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSetSongHeader(t *testing.T) {
	cases := []struct{ in, name, want string }{
		{"TITLE:A\nPREIMAGE:jacket.png\nWAVE:a.ogg\n#START\n1,\n#END\n", "c.webp", "TITLE:A\nPREIMAGE:c.webp\nWAVE:a.ogg\n#START\n1,\n#END\n"},
		{"TITLE:A\r\npreimage:x.png\r\nWAVE:a.ogg\r\n#START\r\n", "c.webp", "TITLE:A\r\nPREIMAGE:c.webp\r\nWAVE:a.ogg\r\n#START\r\n"},
		{"TITLE:A\nWAVE:a.ogg\nBPM:120\n#START\n", "c.webp", "TITLE:A\nWAVE:a.ogg\nPREIMAGE:c.webp\nBPM:120\n#START\n"},
		{"TITLE:A\r\nWAVE:a.ogg\r\n#START\r\n", "c.webp", "TITLE:A\r\nWAVE:a.ogg\r\nPREIMAGE:c.webp\r\n#START\r\n"},
		{"TITLE:A\nPREIMAGE:a.png\nPREIMAGE:b.png\nWAVE:a.ogg\n#START\n", "c.webp", "TITLE:A\nPREIMAGE:c.webp\nPREIMAGE:c.webp\nWAVE:a.ogg\n#START\n"},
		{"TITLE:A\nPREIMAGE:jacket.png\nWAVE:a.ogg\n#START\n", "", "TITLE:A\nPREIMAGE:\nWAVE:a.ogg\n#START\n"},
		{"TITLE:A\nWAVE:a.ogg\n#START\n", "", "TITLE:A\nWAVE:a.ogg\n#START\n"},
		// A header inside a chart block is not the song's.
		{"TITLE:A\nWAVE:a.ogg\n#START\nPREIMAGE:x.png\n", "c.webp", "TITLE:A\nWAVE:a.ogg\nPREIMAGE:c.webp\n#START\nPREIMAGE:x.png\n"},
	}
	for _, c := range cases {
		got, ok := SetSongHeader([]byte(c.in), "PREIMAGE", c.name)
		if !ok || string(got) != c.want {
			t.Errorf("SetSongHeader(%q, %q) = %q, %v; want %q", c.in, c.name, got, ok, c.want)
		}
	}
	if _, ok := SetSongHeader([]byte("TITLE:A\n#START\nWAVE:a.ogg\n"), "PREIMAGE", "c.webp"); ok {
		t.Error("a file without a song WAVE took a new PREIMAGE")
	}
	if got, ok := SetSongHeader([]byte("TITLE:A\n#START\n"), "PREIMAGE", ""); !ok || string(got) != "TITLE:A\n#START\n" {
		t.Error("clearing an absent PREIMAGE should leave the file alone")
	}
}

func TestHeaderFile(t *testing.T) {
	for in, want := range map[string]string{"": "", "a.png": "a.png", `img\b.png`: "b.png", `"../art/c.webp"`: "c.webp", "x/": ""} {
		if got := HeaderFile(in); got != want {
			t.Errorf("HeaderFile(%q) = %q, want %q", in, got, want)
		}
	}
	if got, _ := SetSongHeader([]byte("WAVE:a.ogg\nbgimage:x.png\n#START\n"), "BGIMAGE", "b.webp"); string(got) != "WAVE:a.ogg\nBGIMAGE:b.webp\n#START\n" {
		t.Errorf("BGIMAGE: %q", got)
	}
}
