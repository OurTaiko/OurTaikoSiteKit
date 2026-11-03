package tja

import "testing"

func TestSetMovieHeaders(t *testing.T) {
	for _, c := range []struct {
		in, want string
		offset   float64
	}{
		{"TITLE:A\nWAVE:a.ogg\nBGMOVIE:old.mp4 // c\nMOVIEOFFSET:1\n#START\nBGMOVIE:x\n", "TITLE:A\nWAVE:a.ogg\nBGMOVIE:new.mp4\nMOVIEOFFSET:-0.25\n#START\nBGMOVIE:x\n", -0.25},
		{"TITLE:A\r\nwave:a.ogg\r\nCOURSE:Oni\r\n#START\r\n", "TITLE:A\r\nwave:a.ogg\r\nBGMOVIE:new.mp4\r\nMOVIEOFFSET:3\r\nCOURSE:Oni\r\n#START\r\n", 3},
		{"WAVE:a.ogg\nMOVIEOFFSET:2\n", "WAVE:a.ogg\nBGMOVIE:new.mp4\nMOVIEOFFSET:0\n", 0},
		{"WAVE:a.ogg\n#START\n", "WAVE:a.ogg\nBGMOVIE:new.mp4\n#START\n", 0},
	} {
		got, ok := SetMovieHeaders([]byte(c.in), "new.mp4", c.offset)
		if !ok || string(got) != c.want {
			t.Errorf("%q: got %q %v", c.in, got, ok)
		}
	}
	if _, ok := SetMovieHeaders([]byte("TITLE:A\n#START\nWAVE:a.ogg\n"), "new.mp4", 0); ok {
		t.Error("a TJA without WAVE took the headers")
	}
}
